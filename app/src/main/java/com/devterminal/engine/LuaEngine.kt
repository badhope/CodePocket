package com.devterminal.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import org.luaj.vm2.LuaError
import org.luaj.vm2.lib.DebugLib
import org.luaj.vm2.lib.VarArgFunction
import org.luaj.vm2.LuaValue
import org.luaj.vm2.Varargs
import org.luaj.vm2.lib.jse.JsePlatform
import java.io.BufferedReader
import java.io.File
import java.io.IOException
import java.io.InputStreamReader
import java.io.OutputStream
import java.io.PipedInputStream
import java.io.PipedOutputStream
import java.io.PrintStream
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Lua 运行时：LuaJ 3.0.1（纯 Java，Lua 5.2，无 native/16KB）。
 *
 * 与 Python 引擎共用 RunEngine 语义：stdout/stderr 流、input 阻塞、停止/超时、Finished。
 * 不加载 LuajavaLib，脚本不能反射 Java；os.exit 被覆盖，防止脚本直接杀 App。
 */
class LuaEngine : RunEngine {

    override val isEnvironmentReady: Boolean = true

    private val busy = AtomicBoolean(false)
    private val stopRequested = AtomicBoolean(false)

    @Volatile private var running = false
    @Volatile private var deadlineMs: Long = Long.MAX_VALUE

    @Volatile private var stdinWriter: PipedOutputStream? = null
    @Volatile private var stdinPipe: PipedInputStream? = null

    override suspend fun prepareEnvironment(onProgress: (Long, Long) -> Unit) {
        onProgress(100L, 100L)
    }

    override fun warmup() = Unit

    override fun run(request: RunRequest, timeoutMs: Long): Flow<RunEvent> = callbackFlow {
        if (!busy.compareAndSet(false, true)) {
            trySend(RunEvent.Failed("已有 Lua 程序在运行中，请先停止。"))
            close()
            return@callbackFlow
        }
        val script = File(request.scriptPath)
        if (!script.exists()) {
            busy.set(false)
            trySend(RunEvent.Failed("文件不存在：${request.scriptPath}"))
            close()
            return@callbackFlow
        }

        trySend(RunEvent.Started("lua ${script.name}"))
        bindSink { event -> trySend(event) }
        val startedAt = System.currentTimeMillis()
        running = true
        stopRequested.set(false)
        deadlineMs = startedAt + timeoutMs.coerceAtLeast(1_000L)

        val job = launch(Dispatchers.IO) {
            var exitCode = 0
            val out = EmitStream(false)
            val err = EmitStream(true)
            val outPrint = PrintStream(out, true, "UTF-8")
            val errPrint = PrintStream(err, true, "UTF-8")
            try {
                val pipe = PipedInputStream(8 * 1024)
                val writer = PipedOutputStream(pipe)
                stdinPipe = pipe
                stdinWriter = writer

                val globals = JsePlatform.standardGlobals()
                // standardGlobals 默认带 luajava，脚本可反射调用任意 Java 类；这里彻底摘掉。
                globals.set("luajava", LuaValue.NIL)
                val packageLib = globals.get("package")
                if (!packageLib.isnil()) {
                    packageLib.get("loaded").set("luajava", LuaValue.NIL)
                }
                // LuaJ 的 standardGlobals 不带 debug 库；手动装 DebugLib 才有 sethook，
                // 否则 while true 之类的死循环没有任何中断点。
                globals.load(DebugLib())
                globals.STDOUT = outPrint
                globals.STDERR = errPrint
                globals.STDIN = pipe

                // 不加载 LuajavaLib；standardGlobals 里若带 os，覆盖 exit。
                val os = globals.get("os")
                if (!os.isnil()) {
                    os.set("exit", object : VarArgFunction() {
                        override fun invoke(args: Varargs): Varargs {
                            throw LuaError("os.exit 已被禁用")
                        }
                    })
                }

                // input()：从同一根 stdin 管道读一行
                val reader = BufferedReader(InputStreamReader(pipe, Charsets.UTF_8))
                globals.set("input", object : VarArgFunction() {
                    override fun invoke(args: Varargs): Varargs {
                        val prompt = if (args.narg() > 0) args.arg(1).tojstring() else ""
                        if (prompt.isNotEmpty()) outPrint.println(prompt)
                        val line = try {
                            reader.readLine()
                        } catch (e: IOException) {
                            null
                        }
                        if (line == null) throw LuaError("EOF")
                        return LuaValue.valueOf(line)
                    }
                })

                // 超时/停止：每 1000 条指令检查一次，阻塞在 input 时由 EOF 打断
                globals.set("__codepocket_stop", object : VarArgFunction() {
                    override fun invoke(args: Varargs): Varargs {
                        return LuaValue.valueOf(
                            stopRequested.get() || System.currentTimeMillis() > deadlineMs
                        )
                    }
                })
                if (!globals.get("debug").isnil()) {
                    runCatching {
                        globals.load(
                            """
                            debug.sethook(function()
                                if __codepocket_stop() then
                                    error("运行超时或已停止")
                                end
                            end, "", 1000)
                            """.trimIndent(),
                            "=codepocket-hook"
                        ).call()
                    }
                    // Hook 已装好；把 debug 从用户全局表摘掉，防止脚本 debug.sethook() 自行解除。
                    globals.set("debug", LuaValue.NIL)
                }

                globals.load(script.readText(Charsets.UTF_8), script.name).call()
                outPrint.flush()
                errPrint.flush()
            } catch (e: LuaError) {
                exitCode = 1
                errPrint.flush()
                trySend(RunEvent.Stderr(if (stopRequested.get()) "已停止" else e.message.orEmpty()))
            } catch (e: Throwable) {
                exitCode = 1
                trySend(RunEvent.Stderr(if (stopRequested.get()) "已停止" else (e.message ?: e.javaClass.simpleName)))
            } finally {
                runCatching { stdinWriter?.close() }
                runCatching { outPrint.flush() }
                runCatching { errPrint.flush() }
                stdinWriter = null
                stdinPipe = null
                running = false
                busy.set(false)
                trySend(RunEvent.Finished(exitCode, System.currentTimeMillis() - startedAt))
                close()
            }
        }

        awaitClose {
            // LuaJ 没有安全的跨线程 Thread.stop；stop() 会设置停止标志，
            // 指令 hook 会在下一次检查时抛错。
            if (!job.isCompleted) {
                deadlineMs = 0L
                runCatching { stdinWriter?.close() }
            }
        }
    }.buffer(1024).flowOn(Dispatchers.Default)

    override fun stop() {
        stopRequested.set(true)
        deadlineMs = 0L
        runCatching { stdinWriter?.close() }
    }

    override fun writeStdin(line: String): Boolean {
        if (!running) return false
        return runCatching {
            stdinWriter?.write((line.trimEnd('\n', '\r') + "\n").toByteArray(Charsets.UTF_8))
            stdinWriter?.flush()
            true
        }.getOrDefault(false)
    }

    override fun closeStdin() {
        runCatching { stdinWriter?.close() }
    }

    override fun release() {
        busy.set(false)
        running = false
        runCatching { stdinWriter?.close() }
    }

    private fun trySend(event: RunEvent) {
        sink?.invoke(event)
    }

    private var sink: ((RunEvent) -> Unit)? = null

    private fun bindSink(send: (RunEvent) -> Unit) {
        sink = send
    }

    /** PrintStream 桥：按行转成 RunEvent，避免把整段输出攒到最后。 */
    private inner class EmitStream(private val isErr: Boolean) : OutputStream() {
        private val line = StringBuilder()

        override fun write(b: Int) {
            if (b == '\n'.code) {
                emitLine()
            } else {
                line.append(b.toChar())
            }
        }

        override fun write(b: ByteArray, off: Int, len: Int) {
            for (i in off until off + len) write(b[i].toInt())
        }

        override fun flush() {
            if (line.isNotEmpty()) emitLine()
        }

        private fun emitLine() {
            val text = line.toString()
            line.clear()
            trySend(if (isErr) RunEvent.Stderr(text) else RunEvent.Stdout(text))
        }
    }
}
