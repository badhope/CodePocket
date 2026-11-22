package com.devterminal.model

import com.devterminal.agent.ToolSpec
import com.devterminal.engine.AiClient
import com.devterminal.settings.AppSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * OpenAI 兼容端点的 Agent provider。目前不依赖原生 `tools` 字段：
 * 用文本协议把可用工具和输出格式告诉模型，兼容性最好，也方便之后接小模型。
 */
class OpenAiCompatibleProvider(
    private val settings: AppSettings,
) : ModelProvider {
    override val id: String = "openai-compatible"
    override val label: String = "云端 / OpenAI 兼容"

    override suspend fun complete(
        systemPrompt: String,
        messages: List<ModelMessage>,
        tools: List<ToolSpec>,
        maxTokens: Int,
    ): String = withContext(Dispatchers.IO) {
        val catalog = if (tools.isEmpty()) {
            "（当前没有可用工具）"
        } else {
            tools.joinToString("\n") { spec ->
                val params = spec.parameters.entries.joinToString(", ") { "${it.key}: ${it.value}" }
                "- ${spec.name}($params)：${spec.description}"
            }
        }
        val protocol = """
            你是一个在手机 IDE 里工作的代码 Agent。你每一轮只能输出**一个 JSON 对象**，不要输出 Markdown 代码块以外的解释。
            可用工具：
            $catalog

            输出格式二选一：
            1) 调用工具：
            {"action":"tool","tool":"工具名","arguments":{"参数名":"字符串值"}}
            2) 完成任务：
            {"action":"final","answer":"给用户的简短结论"}

            规则：
            - 一次只调用一个工具；拿到工具结果后再决定下一步。
            - 修改文件只能用 apply_patch，start/end 是 1-based 闭区间。
            - 不确定文件内容时先 read_file 或 search_text，不要猜。
            - 最多 8 步；连续失败就输出 final 说明卡在哪里。
        """.trimIndent()

        val history = messages.map { AiClient.ChatMessage(it.role, it.content) }
        AiClient(settings).chatMessages(
            system = "$systemPrompt\n\n$protocol",
            messages = history,
            maxTokens = maxTokens,
        )
    }
}
