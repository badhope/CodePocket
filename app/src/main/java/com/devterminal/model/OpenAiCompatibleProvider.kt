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
        val history = messages.map { AiClient.ChatMessage(it.role, it.content) }
        AiClient(settings).chatMessages(
            system = AgentProtocol.systemPrompt(
                "你是一个在手机 IDE 里工作的代码 Agent。$systemPrompt",
                tools,
            ),
            messages = history,
            maxTokens = maxTokens,
        )
    }
}
