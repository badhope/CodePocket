package com.devterminal.agent.tools

import com.devterminal.agent.AgentEvent
import com.devterminal.agent.AgentLoop
import com.devterminal.agent.ContextBuilder
import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolRegistry
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.model.ModelProvider
import com.devterminal.workspace.Workspace

/**
 * 只读子 Agent：把“先广泛读代码、再回答/汇总”的探索任务交给一个独立上下文，
 * 主 Agent 只拿到结论，避免把大量文件内容塞进主会话。
 *
 * 子 Agent 不挂 apply_patch / run_command / MCP，不能改文件、不能执行命令，
 * 因此不需要审批，也不会产生检查点；它不是另一个可写主 Agent。
 */
class SubAgentTool(
    private val provider: ModelProvider,
    private val maxSteps: Int = 6,
    private val contextBuilder: ContextBuilder = ContextBuilder(
        maxSystemChars = 3200,
        maxHistoryChars = 2600,
        maxMessageChars = 1200,
    ),
) : Tool {
    override val spec = ToolSpec(
        name = "delegate_task",
        description = "启动一个只读子 Agent 探索项目：适合“先读多个文件/搜索符号再汇总”的独立子任务。" +
            "子 Agent 只能 read_file/list_files/search_text，不能改文件或执行命令；返回它的结论。" +
            "主 Agent 自己仍负责最终修改与验证。",
        parameters = mapOf(
            "task" to "交给子 Agent 的只读探索任务，写清楚要回答什么、看哪些目录或文件",
        ),
        mutatesWorkspace = false,
        executesCommand = false,
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val task = call.arguments["task"]?.trim().orEmpty()
        if (task.isBlank()) return ToolResult.failure(call.id, "delegate_task 缺少 task")
        if (task.length > 4000) return ToolResult.failure(call.id, "子任务过长，请压缩到 4000 字以内")

        val readOnlyTools = ToolRegistry(
            listOf(ReadFileTool(), ListFilesTool(), SearchTextTool()),
        )
        var summary = ""
        val loop = AgentLoop(
            workspace = workspace,
            tools = readOnlyTools,
            provider = provider,
            maxSteps = maxSteps,
            contextBuilder = contextBuilder,
            systemPromptOverride = SUB_AGENT_PROMPT,
        )
        val result = loop.run(task) { event ->
            if (event is AgentEvent.SessionFinished) summary = event.summary
        }
        return if (result.success && summary.isNotBlank()) {
            ToolResult.success(call.id, "子 Agent 完成（${result.steps} 步）：\n${summary.take(5000)}")
        } else {
            ToolResult.failure(
                call.id,
                "子 Agent 未完成：${result.summary.ifBlank { "超过步数或没有返回结论" }}".take(3000),
            )
        }
    }

    companion object {
        const val SUB_AGENT_PROMPT =
            "你是 CodePocket 的只读探索子 Agent。你只能 read_file、list_files、search_text，" +
                "不能修改文件、不能执行命令。先搜索定位，再读关键片段；不要臆测。" +
                "任务完成后输出一个 final JSON，answer 用中文给出可直接交给主 Agent 的结论，" +
                "包含文件路径、行号与关键代码事实；不确定的地方明确说不确定。回答简短。"
    }
}
