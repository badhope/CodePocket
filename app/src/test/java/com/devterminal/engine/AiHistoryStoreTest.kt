package com.devterminal.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class AiHistoryStoreTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `round trips latest messages and clears`() {
        val file = File(temp.root, "ai-chat.json")
        val store = AiHistoryStore(file)
        val messages = listOf(
            AiClient.ChatMessage("user", "解释 main.py"),
            AiClient.ChatMessage("assistant", "它只有一行 print"),
        )
        store.save(messages)

        val loaded = store.load()
        assertEquals(2, loaded.size)
        assertEquals("user", loaded[0].role)
        assertEquals("它只有一行 print", loaded[1].content)

        store.clear()
        assertTrue(store.load().isEmpty())
    }

    @Test
    fun `broken file returns empty instead of crashing`() {
        val file = File(temp.root, "ai-chat.json")
        file.writeText("{not-json")
        assertTrue(AiHistoryStore(file).load().isEmpty())
    }
}
