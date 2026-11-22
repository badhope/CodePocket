package com.devterminal.agent.tools

import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.workspace.Workspace

class SearchTextTool : Tool {
    override val spec = ToolSpec(
        name = "search_text",
        description = "在项目文本文件中搜索关键词，返回文件、行号和命中行。",
        parameters = mapOf(
            "query" to "必填，搜索关键词",
            "glob" to "可选，文件名通配符，例如 *.py",
            "limit" to "最多返回条数，默认 30，上限 100",
        ),
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val query = call.arguments["query"]?.trim()
            ?: return ToolResult.failure(call.id, "search_text 缺少 query")
        if (query.isEmpty()) return ToolResult.failure(call.id, "search_text 的 query 不能为空")
        val glob = call.arguments["glob"]?.trim()?.takeIf { it.isNotEmpty() }
        val limit = (call.arguments["limit"]?.toIntOrNull() ?: 30).coerceIn(1, 100)

        val hits = runCatching { workspace.search(query, glob, limit) }
            .getOrElse { e -> return ToolResult.failure(call.id, "搜索失败：${e.message}") }

        if (hits.isEmpty()) return ToolResult.success(call.id, "没有命中：$query")
        val output = hits.joinToString("\n") { "${it.path}:${it.line}: ${it.text}" }
        return ToolResult.success(
            callId = call.id,
            output = output.take(MAX_OUTPUT_CHARS),
            truncated = output.length > MAX_OUTPUT_CHARS || hits.size >= limit,
        )
    }

    companion object {
        private const val MAX_OUTPUT_CHARS = 5000
    }
}
