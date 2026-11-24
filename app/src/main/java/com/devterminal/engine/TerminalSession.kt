package com.devterminal.engine

import java.io.File
import java.util.concurrent.TimeUnit

/**
 * 轻量命令终端：每条命令独立进程，保留工作目录。
 *
 * 不是 PTY，也不支持 vim/top 这类全屏交互程序；但 cd、pwd、ls、python -m pytest
 * 这类日常命令可以连续执行，且不会把 Android 主进程拖死。
 */
class TerminalSession(private val root: File) {
    private val rootCanonical = root.canonicalFile
    var cwd: File = rootCanonical
        private set

    fun prompt(): String {
        val rel = runCatching { cwd.relativeTo(rootCanonical).path }.getOrDefault("")
        return if (rel.isBlank()) "~ $ " else "~/$rel $ "
    }

    fun execute(command: String, timeoutSeconds: Long = 20L): CommandResult {
        val text = command.trim()
        if (text.isEmpty()) return CommandResult(true, 0, "")
        when {
            text == "pwd" -> return CommandResult(true, 0, cwd.absolutePath)
            text == "cd" || text.startsWith("cd ") -> return changeDir(text.removePrefix("cd").trim())
        }

        val shell = listOf("/system/bin/sh", "/bin/sh").firstOrNull { File(it).exists() }
            ?: return CommandResult(false, -1, "设备没有可用的 sh")
        val output = StringBuilder()
        val process = runCatching {
            ProcessBuilder(shell, "-c", text)
                .directory(cwd)
                .redirectErrorStream(true)
                .start()
        }.getOrElse { e -> return CommandResult(false, -1, "启动失败：${e.message}") }

        val reader = Thread {
            runCatching {
                process.inputStream.bufferedReader().use { input ->
                    input.forEachLine { line ->
                        synchronized(output) {
                            if (output.length < MAX_OUTPUT) output.append(line).append('\n')
                        }
                    }
                }
            }
        }.apply { isDaemon = true; start() }

        val deadline = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(timeoutSeconds.coerceIn(3, 60))
        while (isAlive(process) && System.currentTimeMillis() < deadline) Thread.sleep(100)
        val timedOut = isAlive(process)
        if (timedOut) process.destroy()
        reader.join(1000)
        val exit = if (timedOut) -1 else runCatching { process.exitValue() }.getOrDefault(-1)
        val textOut = synchronized(output) { output.toString().trimEnd().take(MAX_OUTPUT) }
        return CommandResult(!timedOut && exit == 0, exit, textOut.ifBlank { "（无输出）" }, timedOut)
    }

    private fun changeDir(argument: String): CommandResult {
        val target = if (argument.isBlank()) rootCanonical else File(cwd, argument)
        val canonical = runCatching { target.canonicalFile }.getOrElse {
            return CommandResult(false, -1, "目录不存在：$argument")
        }
        val inside = canonical.path == rootCanonical.path ||
            canonical.path.startsWith(rootCanonical.path + File.separator)
        if (!inside || !canonical.isDirectory) {
            return CommandResult(false, -1, "拒绝离开项目目录：$argument")
        }
        cwd = canonical
        return CommandResult(true, 0, "")
    }

    private fun isAlive(process: Process): Boolean = runCatching {
        process.exitValue()
        false
    }.getOrElse { true }

    companion object {
        private const val MAX_OUTPUT = 6000
    }
}
