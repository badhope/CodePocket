package com.devterminal.model

import com.devterminal.agent.ToolSpec
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class LocalLlamaProviderTest {
    @get:Rule
    val temp = TemporaryFolder()

    private class FakeEngine : LlamaEngine {
        var loadCalls = 0
        var freeCalls = 0
        var lastSystem = ""
        var lastUser = ""

        override fun load(model: File, contextSize: Int, threads: Int): Boolean {
            loadCalls++
            return true
        }

        override fun generate(system: String, user: String, maxTokens: Int): String {
            lastSystem = system
            lastUser = user
            return """{"action":"final","answer":"本地完成"}"""
        }

        override fun free() { freeCalls++ }
    }

    @Test
    fun `loads once and flattens history into a single prompt`() = runBlocking {
        val model = File(temp.newFolder("models"), "test.gguf").apply { writeText("x") }
        val spec = ModelCatalog.models.first()
        val engine = FakeEngine()
        val provider = LocalLlamaProvider(model, spec, engine)

        val first = provider.complete("系统", listOf(ModelMessage("user", "修复登录")), emptyList(), 128)
        val second = provider.complete("系统", listOf(ModelMessage("user", "继续")), emptyList(), 128)

        assertEquals(1, engine.loadCalls)
        assertTrue(engine.lastSystem.contains("输出格式二选一"))
        assertTrue(engine.lastUser.contains("用户：继续"))
        assertTrue(first.contains("本地完成"))
        provider.close()
        assertEquals(1, engine.freeCalls)
        assertEquals(second, first)
    }
}
