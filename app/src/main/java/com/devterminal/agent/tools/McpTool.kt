package com.devterminal.agent.tools

import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.agent.mcp.McpClient
import com.devterminal.agent.mcp.McpToolDefinition
import com.devterminal.workspace.Workspace
import org.json.JSONArray
import org.json.JSONObject

/** 把 MCP 工具桥接成 ACI 工具；未知/带副作用工具一律走审批。 */
class McpTool(
    private val client: McpClient,
    private val definition: McpToolDefinition,
) : Tool {

    override val spec = ToolSpec(
        name = "mcp_${definition.name.replace(Regex("[^A-Za-z0-9_]"), "_")}".take(64),
        description = "MCP 远程工具 ${definition.name}：${definition.description}".take(500),
        parameters = definition.parameters,
        mutatesWorkspace = !definition.readOnly,
        executesCommand = !definition.readOnly,
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val args = JSONObject()
        val properties = definition.schema.optJSONObject("properties") ?: JSONObject()
        call.arguments.forEach { (key, value) ->
            if (value.isBlank()) return@forEach
            val type = properties.optJSONObject(key)?.optString("type").orEmpty()
            val converted: Any = when (type) {
                "integer" -> value.toLongOrNull() ?: value
                "number" -> value.toDoubleOrNull() ?: value
                "boolean" -> value.toBooleanStrictOrNull() ?: value
                "object" -> runCatching { JSONObject(value) }.getOrDefault(value)
                "array" -> runCatching { JSONArray(value) }.getOrDefault(value)
                else -> value
            }
            args.put(key, converted)
        }
        val result = client.callTool(definition.name, args)
        val output = "MCP ${definition.name}:\n${result.output.take(4000)}"
        return if (result.ok) {
            ToolResult.success(call.id, output, truncated = result.output.length > 4000)
        } else {
            ToolResult.failure(call.id, output)
        }
    }
}
