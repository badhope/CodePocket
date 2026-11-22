package com.devterminal.agent.tools

import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.workspace.Workspace

class ListFilesTool : Tool {
    override val spec = ToolSpec(
        name = "list_files",
        description = "列出项目内文件，跳过 .git、build、node_modules 等噪音目录。",
        parameters = mapOf(
            "depth" to "最大递归深度，默认 3，上限 8",
            "limit" to "最多返回条数，默认 200，上限 500",
        ),
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val depth = (call.arguments["depth"]?.toIntOrNull() ?: 3).coerceIn(0, 8)
        val limit = (call.arguments["limit"]?.toIntOrNull() ?: 200).coerceIn(1, 500)
        val files = runCatching { workspace.listFiles(depth, limit) }
            .getOrElse { e -> return ToolResult.failure(call.id, "列目录失败：${e.message}") }

        if (files.isEmpty()) return ToolResult.success(call.id, "项目内没有可列出的文件")
        val output = files.joinToString("\n")
        return ToolResult.success(
            callId = call.id,
            output = output.take(MAX_OUTPUT_CHARS),
            truncated = output.length > MAX_OUTPUT_CHARS || files.size >= limit,
        )
    }

    companion object {
        private const val MAX_OUTPUT_CHARS = 5000
    }
}
