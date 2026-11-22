package com.devterminal.agent.tools

import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolRegistry
import com.devterminal.workspace.LocalWorkspace
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class AgentToolsTest {
    @get:Rule
    val temp = TemporaryFolder()

    private fun project(): Pair<File, LocalWorkspace> {
        val root = temp.newFolder("project")
        File(root, "src").mkdirs()
        File(root, "src/main.py").writeText(
            """
            1 def add(a, b):
            2     return a + b
            3
            4 print(add(1, 2))
            """.trimIndent()
        )
        File(root, "src/other.py").writeText("needle\nsecond needle")
        File(root, "build").mkdirs()
        File(root, "build/out.txt").writeText("skip")
        return root to LocalWorkspace(root)
    }

    @Test
    fun `read_file returns numbered window and truncation`() = runBlocking {
        val (_, workspace) = project()
        val tool = ReadFileTool()
        val result = tool.execute(
            ToolCall("1", "read_file", mapOf("path" to "src/main.py", "start" to "2", "limit" to "2")),
            workspace,
        )

        assertTrue(result.ok)
        assertTrue(result.output.contains("2\t"))
        assertTrue(result.output.contains("return a + b"))
        assertTrue(result.output.contains("3\t"))
        assertTrue(result.truncated)
    }

    @Test
    fun `read_file reports missing path`() = runBlocking {
        val (_, workspace) = project()
        val result = ReadFileTool().execute(ToolCall("1", "read_file"), workspace)

        assertFalse(result.ok)
        assertTrue(result.output.contains("缺少 path"))
    }

    @Test
    fun `list_files skips build directory`() = runBlocking {
        val (_, workspace) = project()
        val result = ListFilesTool().execute(
            ToolCall("1", "list_files", mapOf("depth" to "3", "limit" to "100")),
            workspace,
        )

        assertTrue(result.ok)
        assertTrue(result.output.contains("src/main.py"))
        assertFalse(result.output.contains("build/out.txt"))
    }

    @Test
    fun `search_text returns path line and match`() = runBlocking {
        val (_, workspace) = project()
        val result = SearchTextTool().execute(
            ToolCall(
                "1",
                "search_text",
                mapOf("query" to "needle", "glob" to "*.py", "limit" to "10"),
            ),
            workspace,
        )

        assertTrue(result.ok)
        assertTrue(result.output.contains("src/other.py:1:"))
        assertTrue(result.output.contains("src/other.py:2:"))
    }

    @Test
    fun `apply_patch replaces inclusive line range`() = runBlocking {
        val (root, workspace) = project()
        val result = ApplyPatchTool().execute(
            ToolCall(
                "1",
                "apply_patch",
                mapOf(
                    "path" to "src/main.py",
                    "start" to "2",
                    "end" to "2",
                    "replacement" to "    return a - b",
                ),
            ),
            workspace,
        )

        assertTrue(result.ok)
        assertEquals(
            listOf("1 def add(a, b):", "    return a - b", "3", "4 print(add(1, 2))"),
            File(root, "src/main.py").readLines(),
        )
    }

    @Test
    fun `tool registry rejects duplicate names and reports unknown tool`() = runBlocking {
        val (_, workspace) = project()
        val registry = ToolRegistry(listOf(ReadFileTool(), ListFilesTool(), SearchTextTool(), ApplyPatchTool()))

        val result = registry.execute(ToolCall("1", "run_file"), workspace)
        assertFalse(result.ok)
        assertTrue(result.output.contains("Unknown tool"))

        org.junit.Assert.assertThrows(IllegalArgumentException::class.java) {
            ToolRegistry(listOf(ReadFileTool(), ReadFileTool()))
        }
        Unit
    }
}
