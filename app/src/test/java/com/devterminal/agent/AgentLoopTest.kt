package com.devterminal.agent

import com.devterminal.agent.tools.ApplyPatchTool
import com.devterminal.agent.tools.ListFilesTool
import com.devterminal.agent.tools.ReadFileTool
import com.devterminal.agent.tools.SearchTextTool
import com.devterminal.model.ModelMessage
import com.devterminal.model.ModelProvider
import com.devterminal.workspace.LocalWorkspace
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class AgentLoopTest {
    @get:Rule
    val temp = TemporaryFolder()

    private class FakeProvider(private val replies: MutableList<String>) : ModelProvider {
        override val id = "fake"
        override val label = "fake"
        var calls = 0
        var lastSystemPrompt = ""

        override suspend fun complete(
            systemPrompt: String,
            messages: List<ModelMessage>,
            tools: List<ToolSpec>,
            maxTokens: Int,
        ): String {
            calls++
            lastSystemPrompt = systemPrompt
            check(replies.isNotEmpty()) { "FakeProvider has no reply left" }
            return replies.removeAt(0)
        }
    }

    private fun project(): Pair<File, LocalWorkspace> {
        val root = temp.newFolder("project")
        File(root, "src").mkdirs()
        File(root, "src/main.py").writeText("print('old')\n")
        return root to LocalWorkspace(root)
    }

    private fun registry() = ToolRegistry(
        listOf(ReadFileTool(), ListFilesTool(), SearchTextTool(), ApplyPatchTool()),
    )

    @Test
    fun `runs read tool then final`() = runBlocking {
        val (_, workspace) = project()
        val provider = FakeProvider(
            mutableListOf(
                """{"action":"tool","tool":"read_file","arguments":{"path":"src/main.py"}}""",
                """{"action":"final","answer":"文件只有一行打印"}""",
            ),
        )
        val events = mutableListOf<AgentEvent>()
        val result = AgentLoop(workspace, registry(), provider).run("看看 main.py") { events += it }

        assertTrue(result.success)
        assertEquals("文件只有一行打印", result.summary)
        assertEquals(2, result.steps)
        assertTrue(events.any { it is AgentEvent.ToolCall })
        assertTrue(events.any { it is AgentEvent.ToolResult && it.ok })
        assertTrue(events.any { it is AgentEvent.SessionFinished })
        assertEquals(2, provider.calls)
        assertTrue(provider.lastSystemPrompt.contains("项目地图"))
        assertTrue(provider.lastSystemPrompt.contains("src/main.py"))
        assertTrue(events.any { it is AgentEvent.ContextBuilt })
    }

    @Test
    fun `write tool is denied without approval`() = runBlocking {
        val (root, workspace) = project()
        val provider = FakeProvider(
            mutableListOf(
                """{"action":"tool","tool":"apply_patch","arguments":{"path":"src/main.py","start":1,"end":1,"replacement":"print('new')"}}""",
            ),
        )
        val events = mutableListOf<AgentEvent>()
        val result = AgentLoop(
            workspace = workspace,
            tools = registry(),
            provider = provider,
            approve = ApprovalHandler { false },
        ).run("改掉") { events += it }

        assertFalse(result.success)
        assertEquals("print('old')\n", File(root, "src/main.py").readText())
        assertTrue(events.any { it is AgentEvent.PatchProposed })
        assertTrue(events.any { it is AgentEvent.Approval && !it.approved })
        assertFalse(events.any { it is AgentEvent.PatchApplied })
    }

    @Test
    fun `approved patch creates checkpoint and can restore`() = runBlocking {
        val (root, workspace) = project()
        val checkpointDir = temp.newFolder("checkpoints")
        val store = CheckpointStore(checkpointDir, workspace)
        val provider = FakeProvider(
            mutableListOf(
                """{"action":"tool","tool":"apply_patch","arguments":{"path":"src/main.py","start":1,"end":1,"replacement":"print('new')"}}""",
                """{"action":"final","answer":"已修改"}""",
            ),
        )
        val events = mutableListOf<AgentEvent>()
        val result = AgentLoop(
            workspace = workspace,
            tools = registry(),
            provider = provider,
            checkpoints = store,
            approve = ApprovalHandler { true },
        ).run("改成 new") { events += it }

        assertTrue(result.success)
        assertEquals("print('new')", File(root, "src/main.py").readText())
        val checkpointEvent = events.filterIsInstance<AgentEvent.Checkpoint>().single()
        val checkpoint = store.list().single { it.id == checkpointEvent.checkpointId }
        store.restore(checkpoint)
        assertEquals("print('old')\n", File(root, "src/main.py").readText())
        assertTrue(events.any { it is AgentEvent.PatchApplied })
    }

    @Test
    fun `invalid model output is fed back once before failing`() = runBlocking {
        val (_, workspace) = project()
        val provider = FakeProvider(
            mutableListOf(
                "这不是 JSON",
                """{"action":"final","answer":"修正后完成"}""",
            ),
        )
        val events = mutableListOf<AgentEvent>()
        val result = AgentLoop(workspace, registry(), provider, maxSteps = 3)
            .run("test") { events += it }

        assertTrue(result.success)
        assertTrue(events.any { it is AgentEvent.Failure && it.message.contains("无法解析") })
    }
}
