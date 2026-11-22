package com.devterminal.agent.tools

import com.devterminal.agent.ToolCall
import com.devterminal.engine.CommandResult
import com.devterminal.engine.CommandRunner
import com.devterminal.workspace.LocalWorkspace
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class RunToolsTest {
    @get:Rule
    val temp = TemporaryFolder()

    private class FakeRunner(var result: CommandResult) : CommandRunner {
        var lastPath: String? = null
        var lastArgs: List<String>? = null
        var lastPattern: String? = null

        override suspend fun runFile(path: String, args: List<String>, timeoutMs: Long): CommandResult {
            lastPath = path
            lastArgs = args
            return result
        }

        override suspend fun runTests(pattern: String?, timeoutMs: Long): CommandResult {
            lastPattern = pattern
            return result
        }
    }

    private fun workspace(): LocalWorkspace {
        val root = temp.newFolder("project")
        File(root, "main.py").writeText("print('ok')")
        return LocalWorkspace(root)
    }

    @Test
    fun `run_file delegates to runner and returns exit output`() = runBlocking {
        val runner = FakeRunner(CommandResult(true, 0, "hello"))
        val result = RunFileTool(runner).execute(
            ToolCall("1", "run_file", mapOf("path" to "main.py", "args" to "--name \"a b\"")),
            workspace(),
        )

        assertTrue(result.ok)
        assertTrue(result.output.contains("exit=0"))
        assertTrue(result.output.contains("hello"))
        assertTrue(runner.lastPath!!.endsWith("main.py"))
        assertEquals(listOf("--name", "a b"), runner.lastArgs)
    }

    @Test
    fun `run_file reports nonzero exit as failure`() = runBlocking {
        val runner = FakeRunner(CommandResult(false, 2, "Traceback"))
        val result = RunFileTool(runner).execute(
            ToolCall("1", "run_file", mapOf("path" to "main.py")),
            workspace(),
        )

        assertFalse(result.ok)
        assertTrue(result.output.contains("exit=2"))
        assertTrue(result.output.contains("Traceback"))
    }

    @Test
    fun `run_tests passes pattern through`() = runBlocking {
        val runner = FakeRunner(CommandResult(true, 0, "Ran 2 tests"))
        val result = RunTestsTool(runner).execute(
            ToolCall("1", "run_tests", mapOf("pattern" to "test_*.py")),
            workspace(),
        )

        assertTrue(result.ok)
        assertEquals("test_*.py", runner.lastPattern)
    }

    @Test
    fun `run tools declare command approval`() {
        assertTrue(RunFileTool(null).spec.executesCommand)
        assertTrue(RunTestsTool(null).spec.executesCommand)
    }

    @Test
    fun `missing path fails before touching runner`() = runBlocking {
        val runner = FakeRunner(CommandResult(true, 0, "should not run"))
        val result = RunFileTool(runner).execute(ToolCall("1", "run_file"), workspace())

        assertFalse(result.ok)
        assertTrue(result.output.contains("缺少 path"))
        assertEquals(null, runner.lastPath)
    }
}
