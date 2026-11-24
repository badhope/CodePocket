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
    /** 整段提示词（system + history）的粗略 token 上限，给模型留出输出空间。 */
    private val maxPromptTokens: Int = 6000,
) {

    val repoMapMaxChars: Int get() = (maxSystemChars - 500).coerceIn(600, 3000)

    fun systemPrompt(base: String, repoMap: String?, rules: String?): String {
        val parts = buildList {
            add(base.trim())
            if (!rules.isNullOrBlank()) add("项目规则：\n${rules.trim().take(1600)}")
            if (!repoMap.isNullOrBlank()) add(repoMap.trim())
        }
        val text = parts.joinToString("\n\n")
        if (text.length <= maxSystemChars) {
            return trimToTokens(text, (maxPromptTokens / 2).coerceAtLeast(600))
        }

        // 先压 RepoMap，再压规则，最后才动人格提示词。
        val fixed = base.trim()
        val rulesText = rules?.trim()?.take(1000).orEmpty()
        val budget = (maxSystemChars - fixed.length - if (rulesText.isBlank()) 0 else rulesText.length - 20)
        val mapText = repoMap.orEmpty().take(budget.coerceAtLeast(300))
        val assembled = buildString {
            append(fixed)
            if (rulesText.isNotBlank()) append("\n\n项目规则：\n").append(rulesText)
            if (mapText.isNotBlank()) append("\n\n").append(mapText)
        }.take(maxSystemChars)
        return trimToTokens(assembled, (maxPromptTokens / 2).coerceAtLeast(600))
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

    /**
     * 在字符裁剪之后再做一次 token 预算裁剪：保留第一条任务和最近的消息，
     * 超出预算时从最旧的工具观察开始丢。只做估算，不引入 tokenizer 依赖。
     */
    fun compactHistoryFor(history: List<ModelMessage>, systemPrompt: String): List<ModelMessage> {
        val charCompact = compactHistory(history)
        if (charCompact.isEmpty()) return charCompact
        val reserveForOutput = 512
        val budget = (maxPromptTokens - estimateTokens(systemPrompt) - reserveForOutput).coerceAtLeast(320)
        val first = charCompact.first()
        val tail = ArrayList<ModelMessage>()
        var used = estimateTokens(first.content)
        for (message in charCompact.drop(1).asReversed()) {
            val remaining = budget - used
            if (remaining <= 24) break
            val content = trimToTokens(message.content, remaining)
            if (content.isBlank()) break
            tail += message.copy(content = content)
            used += estimateTokens(content)
            if (used >= budget) break
        }
        return listOf(first) + tail.asReversed()
    }

    fun estimateTokens(text: String): Int {
        if (text.isBlank()) return 0
        var cjk = 0
        var other = 0
        for (c in text) {
            val code = c.code
            if (code in 0x2E80..0x9FFF || code in 0xF900..0xFAFF || code in 0x20000..0x2FFFF) cjk++
            else other++
        }
        return cjk + (other + 3) / 4
    }

    fun promptTokens(systemPrompt: String, messages: List<ModelMessage>): Int =
        estimateTokens(systemPrompt) + messages.sumOf { estimateTokens(it.content) }

    /** 按估算 token 截断单条内容；CJK 字符按 1 token、其他字符约 4 字符 1 token。 */
    fun trimToTokens(text: String, maxTokens: Int): String {
        if (maxTokens <= 0) return ""
        if (estimateTokens(text) <= maxTokens) return text
        var cjk = 0
        var other = 0
        val out = StringBuilder()
        for (c in text) {
            val code = c.code
            val isCjk = code in 0x2E80..0x9FFF || code in 0xF900..0xFAFF || code in 0x20000..0x2FFFF
            if (isCjk) {
                if (cjk + other / 4 >= maxTokens) break
                cjk++
            } else {
                if (cjk + (other + 1 + 3) / 4 > maxTokens) break
                other++
            }
            out.append(c)
        }
        return out.toString().trimEnd() + "…"
    }
}
