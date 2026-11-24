package com.devterminal.engine

/**
 * 真 PTY 后端。native 层用 forkpty 起 `/system/bin/sh -i`，字节流回调到
 * [Callback.onBytes]；Kotlin 侧负责 UTF-8 解码和行缓冲。
 *
 * 这是终端后端，不是 ANSI 终端模拟器：`vim`/`top` 能启动、`isatty` 为真，
 * 但光标定位与全屏重绘不会被解释。
 */
class PtyBridge(private val callback: Callback) {
    interface Callback {
        fun onBytes(bytes: ByteArray)
        fun onExit(code: Int)
    }

    /** 返回 0 成功；负值为 errno（-EBUSY 表示已有会话）。 */
    fun start(cwd: String, shell: String = "/system/bin/sh", cols: Int = 80, rows: Int = 24): Int =
        nativeStart(cwd, shell, cols, rows, callback)

    fun write(text: String): Int = nativeWrite(text.toByteArray(Charsets.UTF_8))

    fun resize(cols: Int, rows: Int) = nativeResize(cols, rows)

    fun stop() = nativeStop()

    private external fun nativeStart(
        cwd: String,
        shell: String,
        cols: Int,
        rows: Int,
        callback: Callback,
    ): Int

    private external fun nativeWrite(data: ByteArray): Int
    private external fun nativeResize(cols: Int, rows: Int)
    private external fun nativeStop()

    companion object {
        init { System.loadLibrary("ptybridge") }
    }
}
