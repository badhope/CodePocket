package com.devterminal.engine

import android.util.Log
import java.util.concurrent.BlockingQueue
import java.util.concurrent.LinkedBlockingQueue

/**
 * 原生 Python 引擎的 JNI 桥（对应 cpp/pybridge.c）。
 *
 * 回调线程模型：
 * - [onOutput] / [onState]：由 Python 执行线程（C 侧）回调，只做转发，不碰 UI；
 * - [onInputLine]：由 Python 线程阻塞调用，必须阻塞到用户输入到达——
 *   用 [inputQueue]（BlockingQueue）实现，UI 侧 [NativeEngine.writeStdin] 写入，
 *   返回 null 表示 EOF（用户点了 EOF / 停止）。
 *
 * 线程安全（P3-1）：outBuf/errBuf 由 C 回调线程写、由 Kotlin 侧 flushBuffers 读，
 * 统一用 synchronized(this) 保护。
 *
 * 输出背压（P3-2）：单行缓冲字节数与每次运行的总行数都设上限，
 * 避免 `while True: print(...)` 把 JVM 内存打爆。
 */
class NativeBridge {

    private val inputQueue: BlockingQueue<String?> = LinkedBlockingQueue()

    /** EOF 哨兵：与真实输入行（永不为 null）区分 */
    fun pushInputLine(line: String) { inputQueue.put(line) }
    fun pushEof() { inputQueue.put(null) }
    fun clearPendingInput() { inputQueue.clear() }

    // 行缓冲：CPython 的 print 按参数多次 write（"abc"、"\n" 分开），
    // 必须在 Kotlin 侧拼接后再按 \n 断行，否则 print("a","b") 会显示成多行。
    private val outBuf = StringBuilder()
    private val errBuf = StringBuilder()

    // ---- 背压计数器（每次 run 开始时 resetBuffers） ----
    private var emittedOut = 0L
    private var emittedErr = 0L
    private var droppedLines = 0L

    /** 单条流每次运行最多转发的行数；超出后丢弃最旧（这里直接丢新行并记一次摘要） */
    private val maxLinesPerStream = 10_000L

    /** 单个缓冲最多保留的字节数；超出则截断旧内容 */
    private val maxBufBytes = 256 * 1024

    /** 新一轮运行前清空缓冲与计数 */
    fun resetBuffers() {
        synchronized(this) {
            outBuf.setLength(0)
            errBuf.setLength(0)
            emittedOut = 0
            emittedErr = 0
            droppedLines = 0
        }
    }

    /** 按行转发一行（已计入背压上限） */
    private fun forwardLine(stream: String, line: String) {
        val isErr = stream == "stderr"
        val counter = if (isErr) emittedErr else emittedOut
        if (counter >= maxLinesPerStream) {
            droppedLines++
            return
        }
        if (isErr) emittedErr++ else emittedOut++
        NativeEngine.emitLine(stream, line)
    }

    /** 由 C 层回调：Java bridge 对象方法签名必须与 pybridge.c 中一致 */
    @Suppress("unused")
    fun onOutput(stream: String?, text: String?) {
        val s = text ?: ""
        if (s.isEmpty()) return
        val streamName = stream ?: "stdout"
        synchronized(this) {
            val buf = if (streamName == "stderr") errBuf else outBuf
            // 背压：缓冲已过大时截断旧内容，避免无限增长
            if (buf.length > maxBufBytes) {
                buf.delete(0, buf.length - maxBufBytes / 2)
                droppedLines++
            }
            buf.append(s)
            // 切出所有完整行（含结尾换行的部分），未完结内容留在缓冲区
            var start = 0
            var idx: Int
            while (buf.indexOf('\n', start).also { idx = it } >= 0) {
                val line = buf.substring(start, idx)
                if (line.isNotEmpty()) forwardLine(streamName, line)
                start = idx + 1
            }
            if (start > 0) buf.delete(0, start)
        }
    }

    /** P2-1：run 结束后把无尾换行残留缓冲 flush 成最后一行输出 */
    fun flushBuffers() {
        synchronized(this) {
            if (outBuf.isNotEmpty()) {
                forwardLine("stdout", outBuf.toString())
                outBuf.setLength(0)
            }
            if (errBuf.isNotEmpty()) {
                forwardLine("stderr", errBuf.toString())
                errBuf.setLength(0)
            }
            if (droppedLines > 0) {
                NativeEngine.emitLine(
                    "stderr",
                    "[输出过多，已丢弃 $droppedLines 行]"
                )
            }
        }
    }

    @Suppress("unused")
    fun onState(state: String?, msg: String?) {
        NativeEngine.postState(state ?: "", msg ?: "")
    }

    /**
     * 由 C 层回调（Python 线程，阻塞）：取下一行输入，队列空则等待。
     *
     * 等待前先 flush 未完结输出：pdb/交互程序常先 write("(Pdb) ") 再等输入，
     * 若把无换行前缀留在缓冲区，用户会看到一个没有提示符的空白等待。
     */
    @Suppress("unused")
    fun onInputLine(): String? {
        flushBuffers()
        return inputQueue.take()
    }

    // ---- JNI 方法声明（签名与 pybridge.c 对应） ----
    external fun attach(bridge: NativeBridge)
    external fun detach()
    external fun initialize(stdlibPath: String?, nativeLibDir: String?, crashLogPath: String?): Boolean
    external fun execFile(path: String, workingDir: String, scriptDir: String, args: Array<String>): String?
    external fun requestInterrupt()
    external fun shutdown()

    companion object {
        init { System.loadLibrary("pybridge") }
        private const val TAG = "NativeBridge"
        fun log(msg: String) = Log.i(TAG, msg)
    }
}
