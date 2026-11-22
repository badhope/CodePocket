package com.devterminal.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AgentEventCodecTest {

    @Test
    fun `round trips all event types`() {
        val events = listOf(
            AgentEvent.SessionStarted("/tmp/project"),
            AgentEvent.UserMessage("修复登录"),
            AgentEvent.ContextBuilt(3, 10, 500),
            AgentEvent.Plan(listOf("读文件", "改代码")),
            AgentEvent.ToolCall("c1", "read_file", mapOf("path" to "a.kt", "start" to "1")),
            AgentEvent.ToolResult("c1", true, "ok", truncated = false),
            AgentEvent.PatchProposed("p1", listOf("a.kt"), "diff"),
            AgentEvent.Approval("p1", true),
            AgentEvent.PatchApplied("p1", listOf("a.kt")),
            AgentEvent.Checkpoint("cp1", "before patch"),
            AgentEvent.RunResult(1, "traceback"),
            AgentEvent.Failure("boom"),
            AgentEvent.SessionFinished("done"),
        )
        events.forEach { event ->
            val decoded = AgentEventCodec.decode(AgentEventCodec.encode(event))
            assertNotNull("decode failed for ${event::class.simpleName}", decoded)
            assertEquals(event::class, decoded!!::class)
            assertEquals(event.id, decoded.id)
            assertEquals(event.at, decoded.at)
        }
    }

    @Test
    fun `unknown or broken lines are ignored`() {
        assertNull(AgentEventCodec.decode("not json"))
        assertNull(AgentEventCodec.decode("""{"type":"unknown","id":"x"}"""))
    }
}
