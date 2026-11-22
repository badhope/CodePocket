package com.devterminal.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AgentSessionStoreTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `append read and latest round trip`() {
        val dir = temp.newFolder("sessions")
        val store = AgentSessionStore(dir)
        val id = store.create("/project", "修复登录")

        store.append(id, AgentEvent.SessionStarted("/project"))
        store.append(id, AgentEvent.UserMessage("修复登录"))
        store.append(id, AgentEvent.SessionFinished("完成"))

        val events = store.read(id)
        assertEquals(3, events.size)
        assertTrue(events.last() is AgentEvent.SessionFinished)
        assertTrue(store.list().single().finished)
        assertEquals(id, store.latest()!!.first.id)
    }

    @Test
    fun `latest unfinished session is recoverable`() {
        val dir = temp.newFolder("sessions")
        val store = AgentSessionStore(dir)
        val id = store.create("/project", "跑测试")
        store.append(id, AgentEvent.SessionStarted("/project"))
        store.append(id, AgentEvent.ToolCall("c1", "run_tests", emptyMap()))

        val meta = store.list().single()
        assertFalse(meta.finished)
        assertEquals(2, meta.eventCount)
        assertNotNull(store.latest())
        assertEquals(id, store.latest()!!.first.id)
    }

    @Test
    fun `delete removes session`() {
        val dir = temp.newFolder("sessions")
        val store = AgentSessionStore(dir)
        val id = store.create("/project", "x")
        store.append(id, AgentEvent.SessionFinished("done"))

        assertTrue(store.delete(id))
        assertTrue(store.list().isEmpty())
    }
}
