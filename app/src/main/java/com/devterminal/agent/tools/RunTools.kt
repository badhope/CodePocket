package com.devterminal.agent.tools

import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.engine.CommandRunner
import com.devterminal.workspace.Workspace

class RunFileTool(private val runner: CommandRunner?) : Tool {
    override val spec = ToolSpec(
        name = "run_file",
        description = "运行项目内的可运行文件（Python/JavaScript/Lua），返回退出码和输出尾部。",
        parameters = mapOf(
            "path" to "相对项目根目录的文件路径",
            "args" to "可选，命令行参数字符串",
            "timeout" to "可选，超时秒数，默认 30，上限 60",
        ),
        executesCommand = true,
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val path = call.arguments["path"]?.trim()
            ?: return ToolResult.failure(call.id, "run_file 缺少 path")
        val file = runCatching { workspace.resolve(path) }
            .getOrElse { e -> return ToolResult.failure(call.id, "路径不合法：${e.message}") }
        if (!file.isFile) return ToolResult.failure(call.id, "文件不存在：$path")
        val runner = runner ?: return ToolResult.failure(call.id, "运行时未接入")

        val args = parseArgs(call.arguments["args"].orEmpty())
        val timeout = (call.arguments["timeout"]?.toLongOrNull() ?: 30L)
            .coerceIn(5L, 60L) * 1000L
        val result = runner.runFile(file.absolutePath, args, timeout)
        val output = buildString {
            append("exit=${result.exitCode}")
            if (result.timedOut) append("（超时）")
            append('\n').append(result.output.take(5000))
        }
        return if (result.ok) {
            ToolResult.success(call.id, output, truncated = result.output.length > 5000)
        } else {
            ToolResult.failure(call.id, output)
        }
    }

    private fun parseArgs(raw: String): List<String> {
        if (raw.isBlank()) return emptyList()
        val result = mutableListOf<String>()
        val sb = StringBuilder()
        var inQuote = false
        raw.forEach { c ->
            when {
                c == '"' -> inQuote = !inQuote
                c == ' ' && !inQuote -> if (sb.isNotEmpty()) {
                    result += sb.toString()
                    sb.clear()
                }
                else -> sb.append(c)
            }
        }
        if (sb.isNotEmpty()) result += sb.toString()
        return result
    }
}

class RunTestsTool(private val runner: CommandRunner?) : Tool {
    override val spec = ToolSpec(
        name = "run_tests",
        description = "运行 Python unittest（discover 模式），返回失败测试和 traceback 尾部。",
        parameters = mapOf(
            "pattern" to "可选，测试文件通配符，默认 test*.py",
            "timeout" to "可选，超时秒数，默认 30，上限 60",
        ),
        executesCommand = true,
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val pattern = call.arguments["pattern"]?.trim()?.takeIf { it.isNotEmpty() }
        val timeout = (call.arguments["timeout"]?.toLongOrNull() ?: 30L)
            .coerceIn(5L, 60L) * 1000L
        val runner = runner ?: return ToolResult.failure(call.id, "运行时未接入")
        val result = runner.runTests(pattern, timeout)
        val output = buildString {
            append("exit=${result.exitCode}")
            if (result.timedOut) append("（超时）")
            append('\n').append(result.output.take(5000))
        }
        return if (result.ok) {
            ToolResult.success(call.id, output, truncated = result.output.length > 5000)
        } else {
            ToolResult.failure(call.id, output)
        }
    }
}
