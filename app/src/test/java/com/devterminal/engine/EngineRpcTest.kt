package com.devterminal.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class EngineRpcTest {

    @Test
    fun runRequestRoundTrips() {
        val request = RunRequest(
            scriptPath = "/projects/demo/main.py",
            workingDir = "/projects/demo",
            args = listOf("one", "two words", "-x"),
            languageId = LanguageRegistry.PYTHON.id,
            debug = true
        )
        val payload = EngineRpc.runPayload(42L, request, 90_000L)
        val (id, decoded, timeout) = EngineRpc.decodeRunPayload(payload)
        assertEquals(42L, id)
        assertEquals(request, decoded)
        assertEquals(90_000L, timeout)
    }

    @Test
    fun everyRunEventRoundTrips() {
        val events = listOf(
            RunEvent.Started("python main.py"),
            RunEvent.Stdout("hello"),
            RunEvent.Stderr("boom"),
            RunEvent.Log("warming up"),
            RunEvent.Finished(0, 123L),
            RunEvent.Failed("no runtime")
        )
        events.forEachIndexed { index, event ->
            val pair = EngineRpc.decodeEventPayload(EngineRpc.eventPayload(index.toLong(), event))
            assertEquals(index.toLong(), pair?.first)
            assertEquals(event, pair?.second)
        }
    }

    @Test
    fun malformedPayloadIsRejected() {
        assertNull(EngineRpc.decodeEventPayload("not json"))
        assertNull(EngineRpc.decodeEventPayload("""{"id":1,"type":"unknown"}"""))
        assertTrue(runCatching { EngineRpc.decodeRunPayload("{}") }.isFailure)
    }
}
