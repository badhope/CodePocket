package com.devterminal.agent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class XmlToolCallTest {
    @Test
    fun `accepts minicpm xml tool call`() {
        val raw = "<tool_call>{\"name\":\"read_file\",\"arguments\":{\"path\":\"main.py\"}}</tool_call>"
        val decision = JsonAgentDecisionParser().parse(raw)
        assertTrue(decision is AgentDecision.ToolCall)
        val call = decision as AgentDecision.ToolCall
        assertEquals("read_file", call.tool)
        assertEquals("main.py", call.arguments["path"])
    }
}
