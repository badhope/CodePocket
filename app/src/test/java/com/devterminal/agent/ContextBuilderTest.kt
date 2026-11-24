package com.devterminal.agent

import com.devterminal.model.ModelMessage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ContextBuilderTest {

    @Test
    fun `system prompt carries rules and repo map`() {
        val builder = ContextBuilder(maxSystemChars = 3200)
        val prompt = builder.systemPrompt(
            base = "你是代码 Agent。",
            repoMap = "项目地图：\n- src/Login.kt :: Login",
            rules = "修改前先读文件。",
        )

        assertTrue(prompt.contains("你是代码 Agent"))
        assertTrue(prompt.contains("修改前先读文件"))
        assertTrue(prompt.contains("src/Login.kt"))
        assertTrue(prompt.length <= 3200)
    }

    @Test
    fun `system prompt trims map before identity`() {
        val builder = ContextBuilder(maxSystemChars = 700)
        val hugeMap = "项目地图：\n" + (1..80).joinToString("\n") { "- src/File$it.kt [Kotlin, 10 行] :: Foo" }
        val prompt = builder.systemPrompt("IDENTITY", hugeMap, "RULES")

        assertTrue(prompt.startsWith("IDENTITY"))
        assertTrue(prompt.contains("RULES"))
        assertTrue(prompt.length <= 700)
    }

    @Test
    fun `history keeps first task and most recent observations`() {
        val builder = ContextBuilder(maxHistoryChars = 900, maxMessageChars = 300)
        val history = listOf(ModelMessage("user", "修复登录")) +
            (1..20).map { ModelMessage(if (it % 2 == 1) "assistant" else "user", "message-$it ".repeat(20)) }

        val compact = compactHistory(builder, history)
        assertEquals("修复登录", compact.first().content)
        assertTrue(compact.last().content.contains("message-20"))
        assertTrue(compact.size < history.size)
        assertTrue(compact.sumOf { it.content.length } <= 1200)
    }

    @Test
    fun `token estimator separates cjk and ascii`() {
        val builder = ContextBuilder()
        assertEquals(4, builder.estimateTokens("测试程序"))
        assertEquals(1, builder.estimateTokens("abcd"))
        assertTrue(builder.estimateTokens("中文 mixed 代码") > 2)
    }

    @Test
    fun `token budget keeps first task and newest messages`() {
        val builder = ContextBuilder(
            maxHistoryChars = 20_000,
            maxMessageChars = 10_000,
            maxPromptTokens = 500,
        )
        val system = "系统提示".repeat(20)
        val history = listOf(ModelMessage("user", "初始目标")) +
            (1..30).map { ModelMessage("assistant", "很长的观察结果".repeat(80)) }

        val compact = builder.compactHistoryFor(history, system)
        assertEquals("初始目标", compact.first().content)
        assertTrue(compact.size < history.size)
        assertTrue(compact.last().content.contains("很长的观察结果"))
        assertTrue(builder.promptTokens(system, compact) <= 500 + 20)
    }

    @Test
    fun `empty history stays empty`() {
        assertTrue(compactHistory(ContextBuilder(), emptyList()).isEmpty())
    }

    private fun compactHistory(builder: ContextBuilder, history: List<ModelMessage>): List<ModelMessage> =
        builder.compactHistory(history)
}
