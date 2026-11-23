package com.devterminal.agent.tools

import com.devterminal.agent.ToolCall
import com.devterminal.workspace.LocalWorkspace
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class RunCommandToolTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `runs a shell command in project root`() = runBlocking {
        val root = temp.newFolder("project")
        val result = RunCommandTool().execute(
            ToolCall("c1", "run_command", mapOf("command" to "printf hello")),
            LocalWorkspace(root),
        )

        assertTrue(result.ok)
        assertTrue(result.output.contains("hello"))
        assertTrue(result.output.contains("exit=0"))
    }

    @Test
    fun `blank command is rejected`() = runBlocking {
        val result = RunCommandTool().execute(
            ToolCall("c1", "run_command", emptyMap()),
            LocalWorkspace(temp.newFolder("project2")),
        )
        assertTrue(!result.ok)
        assertTrue(result.output.contains("缺少 command"))
    }
}
