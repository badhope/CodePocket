package com.devterminal.agent.tools

import com.devterminal.agent.SemanticIndex
import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.workspace.Workspace

/**
 * 离线语义搜索：TF-IDF 概念匹配，不是神经网络 embedding。
 * 结果给出行号，模型应再用 read_file 精读，不能凭 preview 直接改代码。
 */
class SemanticSearchTool : Tool {
    override val spec = ToolSpec(
        name = "semantic_search",
        description = "在项目内做离线语义索引搜索（TF-IDF，不需要联网/下载模型）。" +
            "适合用概念词找相关代码块，如“登录校验”“MCP resource”“token 预算”；" +
            "返回路径、行号、相关度和摘要，命中后请用 read_file 精读再改。",
        parameters = mapOf(
            "query" to "概念或关键词，中英文均可",
            "max_results" to "可选，1-12，默认 8",
        ),
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val query = call.arguments["query"]?.trim().orEmpty()
        if (query.isBlank()) return ToolResult.failure(call.id, "semantic_search 缺少 query")
        val limit = call.arguments["max_results"]?.toIntOrNull() ?: 8
        val hits = SemanticIndex(workspace).search(query, limit)
        if (hits.isEmpty()) return ToolResult.success(call.id, "没有找到语义相关块，试试更短的关键词。")
        val text = hits.joinToString("\n\n") { hit ->
            "${hit.path}:${hit.startLine}-${hit.endLine}  相关度 ${"%.3f".format(hit.score)}\n${hit.preview}"
        }
        return ToolResult.success(call.id, text.take(6000), truncated = text.length > 6000)
    }
}
