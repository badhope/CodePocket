package com.devterminal.engine

import android.os.Build
import java.io.File

/**
 * 给每条 shell 命令套一个独立进程组。
 *
 * Android 的 `java.lang.Process` 没有 `ProcessHandle`，`destroyForcibly()` 只能
 * 杀掉直接子进程；`python -m pytest` 再起 worker、`sh -c 'a & b'` 这类命令会在
 * 超时后留下孤儿。这里用 Android 自带的 `setsid` 把命令放进新会话，再对负 PID
 * （进程组）发信号，至少能把同一组里的子孙一起收掉。
 *
 * `setsid` 不存在时退化为普通 `sh -c`，行为和旧版一致；不会因为工具缺失而
 * 让命令起不来。
 */
object ProcessGroup {

    private const val SETSID = "/system/bin/setsid"
    private const val SIGTERM = 15
    private const val SIGKILL = 9

    /** 一个命令的直接子进程 + 它的进程组 ID（setsid 后的 shell PID）。 */
    data class Handle(val process: Process, val pid: Long)

    /**
     * 启动命令。
     *
     * 先用 `sh -c 'echo $$ > pidfile; shift; exec setsid "$@"'` 把 shell PID 落盘：
     * Android 的 `java.lang.Process` 在 API 24 没有 `pid()`，不能直接取 PID；
     * 写文件既不依赖隐藏 API，也能在 setsid 失败时拿到真实 shell PID。
     */
    fun start(
        shell: String,
        command: String,
        cwd: File,
        redirectErrorStream: Boolean,
    ): Handle {
        val pidFile = File.createTempFile("cp-pg-", ".pid")
        val setsid = File(SETSID).takeIf { it.isFile && it.canExecute() }
        val launcher = if (setsid != null) {
            "echo \$\$ > \"\$1\"; shift; exec $SETSID \"\$@\""
        } else {
            "echo \$\$ > \"\$1\"; shift; exec \"\$@\""
        }
        val args = mutableListOf(shell, "-c", launcher, "cp-pg", pidFile.absolutePath, shell, "-c", command)
        val process = ProcessBuilder(args)
            .directory(cwd)
            .redirectErrorStream(redirectErrorStream)
            .start()
        var pid = -1L
        runCatching {
            for (i in 0 until 10) {
                if (pidFile.exists() && pidFile.length() > 0L) {
                    pid = pidFile.readText().trim().toLongOrNull() ?: -1L
                    if (pid > 0L) break
                }
                Thread.sleep(50)
            }
        }
        pidFile.delete()
        return Handle(process, pid)
    }

    /**
     * 先礼后兵：SIGTERM 整个进程组，给 300ms 清理；还活着就 SIGKILL 进程组，
     * 最后再 `destroyForcibly()` 兜底直接子进程。
     */
    fun destroy(handle: Handle) {
        val process = handle.process
        val pid = handle.pid
        if (pid > 0) {
            runCatching { android.os.Process.sendSignal(-pid.toInt(), SIGTERM) }
            Thread.sleep(300)
            if (isAlive(process)) {
                runCatching { android.os.Process.sendSignal(-pid.toInt(), SIGKILL) }
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            runCatching { process.destroyForcibly() }
        } else {
            runCatching { process.destroy() }
        }
        runCatching { process.inputStream.close() }
    }

    fun isAlive(process: Process): Boolean = runCatching {
        process.exitValue()
        false
    }.getOrElse { true }
}
