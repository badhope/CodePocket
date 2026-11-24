package com.devterminal.agent.tools

import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.agent.mcp.McpClient
import com.devterminal.workspace.Workspace
import org.json.JSONObject

/** 列出 MCP resources；只读，不触发审批。 */
class McpResourceListTool(private val client: McpClient) : Tool {
    override val spec = ToolSpec(
        name = "mcp_list_resources",
        description = "列出当前 MCP 服务暴露的 resources（URI、名称、说明）。",
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val resources = client.listResources()
        if (resources.isEmpty()) return ToolResult.success(call.id, "MCP 服务没有暴露 resources")
        val text = resources.joinToString("\n") {
            "- ${it.name} | ${it.uri} | ${it.mimeType.ifBlank { "unknown" }} | ${it.description}"
        }
        return ToolResult.success(call.id, text.take(4000), truncated = text.length > 4000)
    }
}

/** 读取一个 MCP resource 的文本内容；只读。 */
class McpResourceReadTool(private val client: McpClient) : Tool {
    override val spec = ToolSpec(
        name = "mcp_read_resource",
        description = "读取 MCP resource 的文本内容。",
        parameters = mapOf("uri" to "资源 URI，例如 file:///project/README.md"),
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val uri = call.arguments["uri"].orEmpty().trim()
        if (uri.isEmpty()) return ToolResult.failure(call.id, "缺少 uri")
        val text = client.readResource(uri)
        return ToolResult.success(call.id, "MCP resource $uri:\n${text.take(6000)}", truncated = text.length > 6000)
    }
}

/** 列出 MCP prompts；只读。 */
class McpPromptListTool(private val client: McpClient) : Tool {
    override val spec = ToolSpec(
        name = "mcp_list_prompts",
        description = "列出当前 MCP 服务暴露的 prompts 及其参数。",
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val prompts = client.listPrompts()
        if (prompts.isEmpty()) return ToolResult.success(call.id, "MCP 服务没有暴露 prompts")
        val text = prompts.joinToString("\n") {
            "- ${it.name} | 参数：${it.arguments.joinToString().ifBlank { "无" }} | ${it.description}"
        }
        return ToolResult.success(call.id, text.take(4000), truncated = text.length > 4000)
    }
}

/** 获取一个 MCP prompt 展开后的消息；只读。 */
class McpPromptGetTool(private val client: McpClient) : Tool {
    override val spec = ToolSpec(
        name = "mcp_get_prompt",
        description = "按名称获取 MCP prompt，arguments 传 JSON 对象字符串。",
        parameters = mapOf(
            "name" to "prompt 名称",
            "arguments" to "JSON 对象字符串，例如 {\"language\":\"Kotlin\"}，可留空",
        ),
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val name = call.arguments["name"].orEmpty().trim()
        if (name.isEmpty()) return ToolResult.failure(call.id, "缺少 name")
        val args = call.arguments["arguments"].orEmpty().trim()
            .takeIf { it.isNotEmpty() }
            ?.let { runCatching { JSONObject(it) }.getOrElse { JSONObject() } }
            ?: JSONObject()
        val text = client.getPrompt(name, args)
        return ToolResult.success(call.id, "MCP prompt $name:\n${text.take(6000)}", truncated = text.length > 6000)
    }
}
