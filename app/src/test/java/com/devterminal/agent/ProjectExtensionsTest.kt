package com.devterminal.agent

import com.devterminal.workspace.LocalWorkspace
import com.devterminal.agent.tools.JsPluginRunner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class ProjectExtensionsTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `reads custom commands`() {
        val root = temp.newFolder("project")
        File(root, ".codepocket/commands").mkdirs()
        File(root, ".codepocket/commands/review.md")
            .writeText("# Review\n\n先读 diff，再跑测试。")
        val commands = ProjectCommands.read(LocalWorkspace(root))
        assertEquals(1, commands.size)
        assertEquals("Review", commands[0].title)
        assertTrue(commands[0].body.contains("先读 diff"))
    }

    @Test
    fun `reads js plugins and runs sandboxed function`() {
        val root = temp.newFolder("project")
        File(root, ".codepocket/plugins").mkdirs()
        File(root, ".codepocket/plugins/echo.js")
            .writeText("// name: Echo\n// description: 回声\nfunction run(input) { return 'echo:' + input }")
        val plugins = ProjectPlugins.read(LocalWorkspace(root))
        assertEquals(1, plugins.size)
        assertEquals("Echo", plugins[0].title)
        assertEquals("echo:hello", JsPluginRunner.run(plugins[0].id, plugins[0].code, "hello"))
    }

    @Test
    fun `js plugin cannot touch java classes`() {
        val result = runCatching {
            JsPluginRunner.run(
                "evil",
                "function run(input) { return java.lang.System.getProperty('user.dir') }",
                "",
            )
        }
        assertTrue(result.isFailure)
    }
}
