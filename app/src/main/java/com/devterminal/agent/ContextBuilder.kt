package com.devterminal.agent

import com.devterminal.model.ModelMessage

/**
 * 提示词预算器。云端模型可以吃几千 token，但 1B 端侧模型只有 2k 上下文，
 * 所以这里按字符数硬裁：系统提示词保留“人格 + 项目规则 + RepoMap”，
 * 历史消息保留第一条任务和最近几轮工具观察。
 */
class ContextBuilder(
    private val maxSystemChars: Int = 3200,
    private val maxHistoryChars: Int = 2800,
    private val maxMessageChars: Int = 1400,
) {

    val repoMapMaxChars: Int get() = (maxSystemChars - 500).coerceIn(600, 3000)

    fun systemPrompt(base: String, repoMap: String?, rules: String?): String {
        val parts = buildList {
            add(base.trim())
            if (!rules.isNullOrBlank()) add("项目规则：\n${rules.trim().take(1600)}")
            if (!repoMap.isNullOrBlank()) add(repoMap.trim())
        }
        val text = parts.joinToString("\n\n")
        if (text.length <= maxSystemChars) return text

        // 先压 RepoMap，再压规则，最后才动人格提示词。
        val fixed = base.trim()
        val rulesText = rules?.trim()?.take(1000).orEmpty()
        val budget = (maxSystemChars - fixed.length - if (rulesText.isBlank()) 0 else rulesText.length - 20)
        val mapText = repoMap.orEmpty().take(budget.coerceAtLeast(300))
        return buildString {
            append(fixed)
            if (rulesText.isNotBlank()) append("\n\n项目规则：\n").append(rulesText)
            if (mapText.isNotBlank()) append("\n\n").append(mapText)
        }.take(maxSystemChars)
    }

    fun compactHistory(history: List<ModelMessage>): List<ModelMessage> {
        if (history.isEmpty()) return history
        val first = history.first().let { it.copy(content = it.content.take(900)) }
        if (history.size == 1) return listOf(first)

        val tail = ArrayList<ModelMessage>()
        var used = first.content.length
        for (message in history.drop(1).asReversed()) {
            val content = message.content.take(maxMessageChars)
            if (used + content.length > maxHistoryChars && tail.isNotEmpty()) break
            tail += message.copy(content = content)
            used += content.length
        }
        return listOf(first) + tail.asReversed()
    }

    fun totalChars(system: String, messages: List<ModelMessage>): Int =
        system.length + messages.sumOf { it.content.length }
}
