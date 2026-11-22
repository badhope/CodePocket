package com.devterminal.agent

import com.devterminal.workspace.Workspace

/**
 * 工具声明。描述会直接进入模型提示词，参数先使用简单的 name → description，
 * 后续接 MCP 时再映射为 JSON Schema。
 */
data class ToolSpec(
    val name: String,
    val description: String,
    val parameters: Map<String, String> = emptyMap(),
    val mutatesWorkspace: Boolean = false,
    /** 会启动进程/执行命令；即使不写文件也必须审批。 */
    val executesCommand: Boolean = false,
)

data class ToolCall(
    val id: String,
    val name: String,
    val arguments: Map<String, String> = emptyMap(),
)

data class ToolResult(
    val callId: String,
    val ok: Boolean,
    val output: String,
    val truncated: Boolean = false,
) {
    companion object {
        fun success(callId: String, output: String, truncated: Boolean = false): ToolResult =
            ToolResult(callId, true, output, truncated)

        fun failure(callId: String, output: String): ToolResult =
            ToolResult(callId, false, output, truncated = false)
    }
}

/**
 * ACI 工具。实现必须自己限制输出大小，不能把整个文件/整段日志塞回模型。
 */
interface Tool {
    val spec: ToolSpec

    suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult
}

class ToolRegistry(tools: List<Tool>) {
    private val byName: Map<String, Tool>

    init {
        val duplicate = tools.groupBy { it.spec.name }.filterValues { it.size > 1 }.keys
        require(duplicate.isEmpty()) { "Duplicate tool names: $duplicate" }
        byName = tools.associateBy { it.spec.name }
    }

    fun specs(): List<ToolSpec> = byName.values.map { it.spec }

    fun get(name: String): Tool? = byName[name]

    suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val tool = byName[call.name]
            ?: return ToolResult.failure(call.id, "Unknown tool: ${call.name}")
        return runCatching { tool.execute(call, workspace) }
            .getOrElse { error ->
                ToolResult.failure(call.id, "Tool ${call.name} failed: ${error.message ?: error::class.simpleName}")
            }
    }
}
