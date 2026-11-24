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
        var lastMessages: List<ModelMessage> = emptyList()

        override suspend fun complete(
            systemPrompt: String,
            messages: List<ModelMessage>,
            tools: List<ToolSpec>,
            maxTokens: Int,
        ): String {
            calls++
            lastSystemPrompt = systemPrompt
            lastMessages = messages
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
    fun `plan mode emits plan and waits for approval`() = runBlocking {
        val (_, workspace) = project()
        val provider = FakeProvider(
            mutableListOf(
                """{"action":"plan","steps":["读取 src/main.py","改 print 内容"]}""",
                """{"action":"final","answer":"计划已执行"}""",
            ),
        )
        val events = mutableListOf<AgentEvent>()
        var approveCalls = 0
        val result = AgentLoop(
            workspace = workspace,
            tools = registry(),
            provider = provider,
            planFirst = true,
            approvePlan = { approveCalls++; true },
        ).run("改一下") { events += it }

        assertTrue(result.success)
        assertEquals(1, approveCalls)
        assertTrue(events.any { it is AgentEvent.Plan })
        assertTrue(events.any { it is AgentEvent.Approval && it.approved })
        assertEquals(2, provider.calls)
    }

    @Test
    fun `rejected plan stops before tools`() = runBlocking {
        val (root, workspace) = project()
        val provider = FakeProvider(
            mutableListOf("""{"action":"plan","steps":["改文件"]}"""),
        )
        val events = mutableListOf<AgentEvent>()
        val result = AgentLoop(
            workspace = workspace,
            tools = registry(),
            provider = provider,
            planFirst = true,
            approvePlan = { false },
        ).run("改文件") { events += it }

        assertFalse(result.success)
        assertEquals("print('old')\n", File(root, "src/main.py").readText())
        assertTrue(events.any { it is AgentEvent.Plan })
        assertFalse(events.any { it is AgentEvent.ToolCall })
    }

    @Test
    fun `prior conversation is carried into next run`() = runBlocking {
        val (_, workspace) = project()
        val provider = FakeProvider(mutableListOf("""{"action":"final","answer":"继续完成"}"""))
        val prior = listOf(
            ModelMessage("user", "上一轮目标"),
            ModelMessage("assistant", "上一轮结论"),
        )
        val result = AgentLoop(workspace, registry(), provider)
            .run("接着做", prior) { }

        assertTrue(result.success)
        assertEquals("上一轮目标", provider.lastMessages.first().content)
        assertTrue(provider.lastMessages.any { it.content == "接着做" })
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
