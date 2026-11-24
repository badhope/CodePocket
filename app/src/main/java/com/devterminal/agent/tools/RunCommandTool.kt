package com.devterminal.agent.tools

import android.os.Build
import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.workspace.Workspace
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * 受限终端：在项目根目录执行一条 sh 命令。
 *
 * 不是 PTY，不提供交互式 stdin；每次执行都必须经过 Agent 的写前审批。
 * 输出只回传尾部，超时或输出过大都会截断，避免把手机拖死。
 */
class RunCommandTool : Tool {
    override val spec = ToolSpec(
        name = "run_command",
        description = "在项目根目录执行一条 sh 命令（非交互式），返回退出码和输出尾部。适合跑 ls、grep、python -m pytest 等。",
        parameters = mapOf(
            "command" to "要执行的 shell 命令",
            "timeout" to "可选，超时秒数，默认 20，上限 60",
        ),
        executesCommand = true,
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val command = call.arguments["command"].orEmpty().trim()
        if (command.isEmpty()) return ToolResult.failure(call.id, "run_command 缺少 command")
        val timeout = (call.arguments["timeout"]?.toLongOrNull() ?: 20L).coerceIn(5L, 60L)
        val shell = listOf("/system/bin/sh", "/bin/sh").firstOrNull { File(it).exists() }
            ?: return ToolResult.failure(call.id, "设备没有可用的 sh")

        val output = StringBuilder()
        val process = runCatching {
            ProcessBuilder(shell, "-c", command)
                .directory(workspace.root)
                .redirectErrorStream(true)
                .start()
        }.getOrElse { e ->
            return ToolResult.failure(call.id, "启动命令失败：${e.message}")
        }

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

        val deadline = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(timeout)
        var timedOut = false
        while (isProcessAlive(process) && System.currentTimeMillis() < deadline) {
            Thread.sleep(100)
        }
        if (isProcessAlive(process)) {
            timedOut = true
            destroyTree(process)
            runCatching { process.inputStream.close() }
        }
        reader.join(1500)
        val exitCode = if (timedOut) -1 else runCatching { process.exitValue() }.getOrDefault(-1)
        val text = synchronized(output) { output.toString().take(MAX_OUTPUT) }
        val body = buildString {
            append("exit=$exitCode")
            if (timedOut) append("（超时）")
            append('\n').append(text.ifBlank { "（无输出）" })
        }
        return if (!timedOut && exitCode == 0) {
            ToolResult.success(call.id, body, truncated = text.length >= MAX_OUTPUT)
        } else {
            ToolResult.failure(call.id, body)
        }
    }

    /** Android 的 Process 没有 ProcessHandle；至少强杀 sh 并关闭输出流，避免 reader 挂死。 */
    private fun destroyTree(process: Process) {
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) process.destroyForcibly()
            else process.destroy()
        }
        runCatching { process.inputStream.close() }
    }

    private fun isProcessAlive(process: Process): Boolean = runCatching {
        process.exitValue()
        false
    }.getOrElse { true }

    companion object {
        private const val MAX_OUTPUT = 6000
    }
}
