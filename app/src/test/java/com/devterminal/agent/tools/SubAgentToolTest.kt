package com.devterminal.agent.tools

import com.devterminal.agent.ToolCall
import com.devterminal.model.ModelMessage
import com.devterminal.model.ModelProvider
import com.devterminal.agent.ToolSpec
import com.devterminal.workspace.LocalWorkspace
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class SubAgentToolTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `returns child agent final answer`() = runBlocking {
        val root = temp.newFolder("project")
        val provider = object : ModelProvider {
            override val id = "fake"
            override val label = "fake"
            override suspend fun complete(
                systemPrompt: String,
                messages: List<ModelMessage>,
                tools: List<ToolSpec>,
                maxTokens: Int,
            ): String = """{"action":"final","answer":"auth.kt 里有 login 与 issueToken"}"""
        }
        val tool = SubAgentTool(provider)
        val result = tool.execute(
            ToolCall("c1", "delegate_task", mapOf("task" to "找登录相关代码")),
            LocalWorkspace(root),
        )
        assertTrue(result.ok)
        assertTrue(result.output.contains("auth.kt"))
        assertTrue(result.output.contains("子 Agent 完成"))
    }
}
