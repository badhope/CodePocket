package com.devterminal.model

import com.devterminal.agent.ToolSpec

data class ModelMessage(
    val role: String,
    val content: String,
)

/**
 * 云端口 / 本地模型统一入口。AgentLoop 不关心底下是 HTTP 还是 llama.cpp。
 */
interface ModelProvider {
    val id: String
    val label: String

    /** 单轮最大输出 token；端侧小模型上下文紧张，默认比云端更小。 */
    val maxOutputTokens: Int get() = 2000

    suspend fun complete(
        systemPrompt: String,
        messages: List<ModelMessage>,
        tools: List<ToolSpec>,
        maxTokens: Int = 2000,
    ): String
}
