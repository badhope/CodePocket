package com.devterminal.engine

import android.content.Context
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import java.util.zip.ZipFile
import kotlinx.coroutines.flow.buffer

/**
 * 原生 Python 引擎（CPython 3.13.9 官方 Android 支持，PEP 738）。
 *
 * 实现 [RunEngine] 接口，UI 层零改动。
 *
 * 特性：
 * - 原生 arm64-v8a / x86_64（模拟器、ChromeOS）
 * - 真实文件系统：脚本直接读写 App 私有目录，cwd = 项目目录
 * - stdin/stdout 在 Python 层桥接：input()/print() 天然可用
 * - 中断走 CPython 官方 Py_AddPendingCall：死循环可被 KeyboardInterrupt 终止
 *
 * 标准库存放在 files/python-stdlib（首次运行时从 assets 解压），
 * libpython3.13.so、libpybridge.so 在 jniLibs/<abi>；Python C 扩展在首次启动时
 * 从 APK 的 lib/<abi> 抽到 python-stdlib/lib/python3.13/lib-dynload。
 */
class NativeEngine(private val context: Context) : RunEngine {

    private val bridge = NativeBridge()
    private val readyFlag = AtomicBoolean(false)
    override val isEnvironmentReady: Boolean get() = readyFlag.get()

    private val busy = AtomicBoolean(false)

    /** 解释器初始化是否完成（首次 run 前惰性初始化，耗时约 0.5~2s） */
    private val initLock = Any()
    @Volatile
    private var initialized = false

    @Volatile
    private var running = false

    @Volatile
    private var startedAt = 0L

    /** 事件出口：C 回调 → Flow（同一时刻只有一个运行） */
    private val sink = AtomicReference<((RunEvent) -> Unit)?>(null)

    /**
     * 单次运行的 Finished 幂等标记：看门狗超时、stop 兜底、execFile 正常返回
     * 三路都可能触发收尾，只有第一个生效。run 开始前复位。
     */
    private val finishedSent = AtomicBoolean(false)

    /** execFile 是否仍在执行（stop 兜底线程据此判断脚本是否已收尾） */
    private val execActive = AtomicBoolean(false)

    /** 高频输出时 channel 满导致丢弃的行数；运行结束前会明确告诉用户 */
    private val droppedLines = AtomicLong(0)

    // ==================== 初始化 ====================

    private val stdlibMarker = ".unpacked_ok"

    /** P1-1：解压完整性校验——标记文件 + 关键 stdlib 文件都在才算可用 */
    private fun hasStdlibFiles(dest: File): Boolean {
        if (!File(dest, "lib/python3.13/os.py").exists()) return false
        if (!File(dest, "lib/python3.13/encodings/__init__.py").exists()) return false
        return true
    }

    private fun stdlibOk(dest: File): Boolean =
        File(dest, stdlibMarker).exists() && hasStdlibFiles(dest)

    private fun ensureStdlib(onProgress: ((Long, Long) -> Unit)? = null): File {
        // 标准库存放在 files/python-stdlib；不存在或校验失败时从 assets/python-stdlib.zip 解压
        val dest = File(context.filesDir, "python-stdlib")
        if (stdlibOk(dest)) return dest
        synchronized(initLock) {
            if (stdlibOk(dest)) return dest
            // 半残目录先清空重建（失败可自愈）
            dest.deleteRecursively()
            dest.mkdirs()
            val zip = File(context.filesDir, "python-stdlib.zip")
            if (!zip.exists()) {
                context.assets.open("python-stdlib.zip").use { input ->
                    zip.outputStream().use { output -> input.copyTo(output) }
                }
            }
            // P1-1：解压失败不删 zip、不返回半残目录，向上抛异常
            // P2-7：按 ZipEntry 总数回调进度（每 10% 上报一次）
            try {
                java.util.zip.ZipFile(zip).use { zf ->
                    val total = zf.size().toLong()
                    onProgress?.invoke(0L, total)
                    var done = 0L
                    var lastBucket = -1
                    zf.entries().asSequence().forEach { e ->
                        val target = File(dest, e.name)
                        if (e.isDirectory) { target.mkdirs() }
                        else {
                            target.parentFile?.mkdirs()
                            zf.getInputStream(e).use { src -> target.outputStream().use { dst -> src.copyTo(dst) } }
                        }
                        done++
                        // 每 10% 一个桶回调一次；total==0 时不做除法
                        val bucket = if (total > 0) (done * 10L / total).toInt() else 10
                        if (bucket != lastBucket) {
                            lastBucket = bucket
                            onProgress?.invoke(done, total)
                        }
                    }
                    onProgress?.invoke(total, total)
                }
            } catch (e: Exception) {
                android.util.Log.e("NativeEngine", "stdlib 解压失败", e)
                throw RuntimeException("Python 标准库解压失败：${e.message}", e)
            }
            if (!hasStdlibFiles(dest)) {
                throw RuntimeException("Python 标准库解压后校验失败")
            }
            File(dest, stdlibMarker).createNewFile()
            // 解压成功后删除临时 zip 节省空间
            zip.delete()
            // P2-4：确保 site-packages 目录存在
            File(dest, "lib/python3.13/site-packages").mkdirs()
        }
        return dest
    }

    private fun ensureInitialized(onProgress: ((Long, Long) -> Unit)? = null): Boolean {
        if (initialized) return true
        synchronized(initLock) {
            if (initialized) return true
            val stdlib = try {
                ensureStdlib(onProgress)
            } catch (e: Exception) {
                android.util.Log.e("NativeEngine", "准备 Python 标准库失败", e)
                return false
            }
            // Android PackageManager 只会把 lib<name>.so 解压到 nativeLibraryDir；
            // CPython 的 C 扩展名是 math.cpython-313-...so，不带 lib 前缀，必须由 App
            // 自己从 APK 抽到标准库的 lib-dynload 目录，否则 import math/_ssl/_socket
            // 会全部失败。此步骤失败不让解释器整体罢工——基础 print 仍可用，自检会报红。
            runCatching { ensureExtensions(stdlib) }
                .onFailure { android.util.Log.e("NativeEngine", "准备 Python C 扩展失败", it) }
            // P0-1：传入 nativeLibraryDir（依赖库 .so 所在）与 crash-native.log 路径
            val nativeLibDir = context.applicationInfo.nativeLibraryDir
            val crashLog = File(context.filesDir, "crash-native.log").absolutePath
            val ok = runCatching {
                NativeEngine.bind(this)
                bridge.attach(bridge)
                bridge.initialize(stdlib.absolutePath, nativeLibDir, crashLog)
            }.getOrDefault(false)
            initialized = ok
            readyFlag.set(ok)
            return ok
        }
    }

    /**
     * 把 APK 里 lib/<当前 ABI> 下的 Python C 扩展抽到
     * python-stdlib/lib/python3.13/lib-dynload。
     *
     * 这些文件名形如 math.cpython-313-aarch64-linux-android.so，不满足 Android
     * PackageManager 的 lib&lt;name&gt;.so 规则，安装时不会被解压到 nativeLibraryDir。
     * 依赖库（libpython3.13.so / libssl_python.so 等）仍由 PackageManager 解压，
     * dlopen 时会从 nativeLibraryDir 正常解析。
     */
    private fun ensureExtensions(stdlib: File): File {
        val dest = File(stdlib, "lib/python3.13/lib-dynload")
        val abi = Build.SUPPORTED_ABIS.firstOrNull { it == "arm64-v8a" || it == "x86_64" }
            ?: Build.SUPPORTED_ABIS.firstOrNull().orEmpty()
        val abiPrefix = "lib/$abi/"
        val triple = when (abi) {
            "arm64-v8a" -> "aarch64-linux-android"
            "x86_64" -> "x86_64-linux-android"
            else -> abi
        }
        val marker = File(dest, ".extracted_ok")
        val math = File(dest, "math.cpython-313-$triple.so")
        val ssl = File(dest, "_ssl.cpython-313-$triple.so")
        if (marker.isFile && math.isFile && math.length() > 0 &&
            ssl.isFile && ssl.length() > 0) return dest

        dest.deleteRecursively()
        dest.mkdirs()
        val apk = File(context.applicationInfo.sourceDir)
        if (!apk.isFile) {
            throw RuntimeException("找不到已安装的 APK：${apk.absolutePath}")
        }
        var copied = 0
        try {
            ZipFile(apk).use { zf ->
                val entries = zf.entries()
                while (entries.hasMoreElements()) {
                    val e = entries.nextElement()
                    if (e.isDirectory) continue
                    if (!e.name.startsWith(abiPrefix)) continue
                    if (!e.name.endsWith(".so")) continue
                    val name = e.name.substringAfterLast('/')
                    // lib<name>.so 已由 PackageManager 解压；这里只抽 Python 扩展
                    if (name.startsWith("lib")) continue
                    if (!name.contains(".cpython-")) continue
                    val target = File(dest, name)
                    zf.getInputStream(e).use { src ->
                        target.outputStream().use { dst -> src.copyTo(dst) }
                    }
                    copied++
                }
            }
        } catch (e: Exception) {
            throw RuntimeException("Python C 扩展解压失败：${e.message}", e)
        }
        if (copied == 0) {
            throw RuntimeException("APK 的 lib/$abi 中没有 Python C 扩展")
        }
        if (!math.isFile || math.length() <= 0L) {
            throw RuntimeException("Python C 扩展缺少 math 模块")
        }
        marker.createNewFile()
        return dest
    }

    override suspend fun prepareEnvironment(onProgress: (Long, Long) -> Unit) {
        onProgress(0L, 100L)
        val ok = withContext(Dispatchers.IO) { ensureInitialized(onProgress) }
        onProgress(100L, 100L)
        if (!ok) throw IllegalStateException("原生 Python 解释器初始化失败")
    }

    /**
     * 后台预热（无进度回调）。
     * 已被带进度的 [prepareEnvironment] 取代；保留是为兼容仍在调用旧接口的 UI，
     * 新代码请改用 suspend prepareEnvironment(onProgress) 以接入解压进度。
     */
    @Deprecated("改用 prepareEnvironment(onProgress) 以获得解压进度回调", ReplaceWith("prepareEnvironment { _, _ -> }"))
    override fun warmup() {
        Thread {
            runCatching { ensureInitialized() }
        }.start()
    }

    // ==================== 运行 ====================

    /** 把 pdb 包装器写到 cacheDir；不污染用户项目文件树。 */
    private fun writePdbRunner(): File {
        val runner = File(context.cacheDir, PdbRunner.FILE_NAME)
        runner.writeText(PdbRunner.SCRIPT)
        return runner
    }

    override fun run(request: RunRequest, timeoutMs: Long): Flow<RunEvent> = callbackFlow {
        if (busy.getAndSet(true)) {
            trySend(RunEvent.Failed("已有程序在运行中，请先停止。"))
            close(); return@callbackFlow
        }

        val script = File(request.scriptPath)
        if (!script.exists()) {
            trySend(RunEvent.Failed("文件不存在：${request.scriptPath}"))
            busy.set(false); close(); return@callbackFlow
        }

        // P2-8：首次 Py_Initialize 较慢，先给一行静音日志提示
        if (!initialized) {
            trySend(RunEvent.Log("首次运行正在预热解释器…"))
        }
        // 首次运行前初始化解释器（预热过则秒过）
        if (!ensureInitialized()) {
            trySend(RunEvent.Failed("原生 Python 初始化失败，请检查原生库与 C 扩展是否随 APK 安装"))
            busy.set(false); close(); return@callbackFlow
        }

        trySend(RunEvent.Started(if (request.debug) "python -m pdb ${script.name}" else "python ${script.name}"))
        val started = System.currentTimeMillis()
        startedAt = started
        running = true
        finishedSent.set(false)
        bridge.clearPendingInput()
        bridge.resetBuffers()

        // P1-2：工作目录与脚本目录
        val workingDir = if (request.workingDir.isNotBlank()) request.workingDir
                         else script.parentFile?.absolutePath ?: "/"
        val scriptDir = script.parentFile?.absolutePath ?: ""
        // pdb 不能直接跑目标文件：需要一个 Python 包装器把目标代码编译后交给
        // pdb.run。包装器放在 cacheDir，不污染用户文件树；sys.path 仍指向项目目录。
        val execScript = if (request.debug) writePdbRunner() else script
        val execArgs = if (request.debug) listOf(script.absolutePath) + request.args else request.args

        // 事件出口（C 回调线程 → Flow）。注意这里只做转发；
        // busy/running 的复位统一交给 exec 线程的 finally 收尾（见下）。
        droppedLines.set(0)
        sink.set { ev ->
            val result = trySend(ev)
            if (result.isFailure && (ev is RunEvent.Stdout || ev is RunEvent.Stderr)) {
                droppedLines.incrementAndGet()
            }
        }

        /**
         * Finished 只发一次：看门狗超时补发、stop 兜底与 execFile 正常返回都可能触发，
         * 不幂等的话 UI 会收到多条"进程结束"。
         */
        fun sendFinished(exitCode: Int, startedAt: Long) {
            if (finishedSent.compareAndSet(false, true)) {
                trySend(RunEvent.Finished(exitCode, System.currentTimeMillis() - startedAt))
            }
        }

        execActive.set(true)
        val job = launch(Dispatchers.IO) {
            try {
                // 跑在专用线程，Py_Initialize 已在 initialize() 完成（持 GIL 语义由 C 层管理）
                // P1-2：把命令行参数透传到 sys.argv[1:]
                val err = bridge.execFile(
                    execScript.absolutePath,
                    workingDir,
                    scriptDir,
                    execArgs.toTypedArray(),
                )
                // P2-1：无尾换行的最后一行残留在此 flush
                bridge.flushBuffers()
                val dropped = droppedLines.get()
                if (dropped > 0) {
                    trySend(RunEvent.Log("输出过快，已丢弃 $dropped 行；请减少 print 频率或分批输出"))
                }
                if (err != null) {
                    sink.get()?.invoke(RunEvent.Stderr(err))
                    sendFinished(1, started)
                } else {
                    sendFinished(0, started)
                }
            } finally {
                /**
                 * P4-2：只有 execFile 真正返回才复位 busy/running 并清 sink。
                 * execFile 是阻塞 JNI 调用，协程 cancel 无法中断它；若在 Finished
                 * 事件或 awaitClose 里提前复位 busy，旧线程仍在跑时用户点「运行」
                 * 会启动第二个脚本——两个 Python 执行在同一解释器里排队交错，
                 * sys.path/cwd/argv 互相污染，输出串台。串行约束必须等旧线程落地。
                 */
                execActive.set(false)
                sink.set(null)
                busy.set(false)
                running = false
                close()
            }
        }

        // Kotlin 侧兜底看门狗：JS 引擎同款语义
        val watchdog = launch(Dispatchers.IO) {
            kotlinx.coroutines.delay(timeoutMs + 5_000L)
            if (running) {
                // P0-2：先 pushEof 打断可能阻塞在 input() 的脚本，再 requestInterrupt
                sink.get()?.invoke(RunEvent.Stderr("运行超时，正在发送中断..."))
                bridge.pushEof()
                bridge.requestInterrupt()
                // P3-5：给中断 2 秒生效；仍未退出则警告并标记异常结束（不杀原生线程）
                kotlinx.coroutines.delay(2_000L)
                if (running) {
                    android.util.Log.w("NativeEngine", "脚本未响应中断，超时强制收尾")
                    sink.get()?.invoke(RunEvent.Stderr("警告：脚本未响应中断，可能仍在后台运行。"))
                    sendFinished(130, started)
                }
            }
        }

        awaitClose {
            // 不能 job.cancel()：execFile 是阻塞 JNI 调用，取消只会让 Finish 事件
            // 静默丢失；也不能提前清 sink / 复位 busy——由 job.finally 统一收尾，
            // 保证"上一个脚本真正结束"之前不允许下一个运行开始。
            watchdog.cancel()
        }
    }.buffer(1024).flowOn(Dispatchers.Default)

    override fun stop() {
        // P4-2：不再把 running 置 false 就完事——running 的复位统一交给
        // execFile 的 finally，保证"旧脚本真正结束前" busy 不会被释放。
        // 这里只发中断信号。
        // P0-2：必须先 pushEof——若脚本正阻塞在 input()（JNI 调用上，GIL 被攥死），
        // EOFError 让 input() 立即返回；之后再 requestInterrupt 处理纯 CPU 死循环。
        // 顺序反了会在 requestInterrupt 拿 GIL 时永久死锁，pushEof 永远执行不到。
        bridge.pushEof()
        runCatching { bridge.requestInterrupt() }
        // P4-2 兜底：中断 2s 后 execFile 仍未返回（脚本不响应 KeyboardInterrupt，
        // 如阻塞在不可中断的 C 扩展调用），补发 Finished(130) 让 UI 收尾。
        // busy 仍由 execFile 的 finally 复位，杜绝并发运行。
        Thread {
            Thread.sleep(2_000L)
            if (execActive.get() && finishedSent.compareAndSet(false, true)) {
                android.util.Log.w("NativeEngine", "停止后脚本未响应中断，补发收尾事件")
                sink.get()?.invoke(RunEvent.Finished(130, System.currentTimeMillis() - startedAt))
            }
        }.apply { isDaemon = true }.start()
    }

    override fun writeStdin(line: String): Boolean {
        bridge.pushInputLine(line)
        return true
    }

    override fun closeStdin() {
        bridge.pushEof()
    }

    override fun release() {
        // 即使 initialized=false 也要 shutdown：initialize 可能在 Py_Initialize 之后、
        // 返回失败之前就退出，留下一个未关闭的解释器；下一次重建会踩到它。
        runCatching { bridge.shutdown() }
        runCatching { bridge.detach() }
        initialized = false
        readyFlag.set(false)
        // P3-3：复位静态 sink，避免重建引擎时 C 回调串到旧实例
        NativeEngine.unbind()
    }

    // ==================== C 回调入口 ====================

    private fun emit(ev: RunEvent) { sink.get()?.invoke(ev) }

    /** 由 NativeBridge 静态转发调用（C 回调线程） */
    companion object {
        private val stateSink = AtomicReference<(String, String) -> Unit>(null)
        private val lineSink = AtomicReference<(String, String) -> Unit>(null)

        /** 绑定到当前 NativeEngine 实例 */
        fun bind(engine: NativeEngine) {
            stateSink.set { s, m -> engine.onState(s, m) }
            lineSink.set { s, t -> engine.onLine(s, t) }
        }

        /** P3-3：解绑，释放静态引用 */
        fun unbind() {
            stateSink.set(null)
            lineSink.set(null)
        }

        fun emitLine(stream: String, text: String) {
            lineSink.get()?.invoke(stream, text)
        }

        fun postState(state: String, msg: String) {
            stateSink.get()?.invoke(state, msg)
        }
    }

    private fun onLine(stream: String, text: String) {
        emit(if (stream == "stderr") RunEvent.Stderr(text) else RunEvent.Stdout(text))
    }

    private fun onState(state: String, msg: String) {
        if (state == "ready") readyFlag.set(true)
    }
}
