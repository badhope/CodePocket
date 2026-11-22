package com.devterminal.agent.tools

import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.workspace.Workspace

class ReadFileTool : Tool {
    override val spec = ToolSpec(
        name = "read_file",
        description = "读取项目内文件的指定行区间。只返回窗口，不返回整个文件。",
        parameters = mapOf(
            "path" to "相对项目根目录的文件路径",
            "start" to "起始行，1-based，默认 1",
            "limit" to "最多读取行数，默认 120，上限 200",
        ),
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val path = call.arguments["path"]?.trim()
            ?: return ToolResult.failure(call.id, "read_file 缺少 path")
        val start = call.arguments["start"]?.toIntOrNull() ?: 1
        val limit = (call.arguments["limit"]?.toIntOrNull() ?: 120).coerceIn(1, 200)

        val window = runCatching { workspace.readText(path, start, limit) }
            .getOrElse { e -> return ToolResult.failure(call.id, "读取失败：${e.message}") }

        if (window.totalLines == 0) {
            return ToolResult.success(call.id, "${window.path} 是空文件（0 行）")
        }
        if (window.startLine > window.totalLines) {
            return ToolResult.success(
                call.id,
                "${window.path} 只有 ${window.totalLines} 行，start=${window.startLine} 已越界",
            )
        }

        val header = "${window.path}: ${window.startLine}-${window.endLine} / ${window.totalLines} 行"
            .let { if (window.truncated) "$it（后面还有）" else it }
        val body = window.numbered()
        val output = "$header\n$body"
        return ToolResult.success(
            callId = call.id,
            output = output.take(MAX_OUTPUT_CHARS),
            truncated = output.length > MAX_OUTPUT_CHARS || window.truncated,
        )
    }

    companion object {
        private const val MAX_OUTPUT_CHARS = 6000
    }
}
