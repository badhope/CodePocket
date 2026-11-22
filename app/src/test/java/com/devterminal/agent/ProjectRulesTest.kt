package com.devterminal.agent

import com.devterminal.workspace.LocalWorkspace
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class ProjectRulesTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `reads AGENTS md`() {
        val root = temp.newFolder("project")
        File(root, "AGENTS.md").writeText("用中文回答。\n不要改 build.gradle。")
        val rules = ProjectRules.read(LocalWorkspace(root))

        assertTrue(rules!!.contains("用中文回答"))
        assertTrue(rules.contains("AGENTS.md"))
    }

    @Test
    fun `falls back to codepocket rules`() {
        val root = temp.newFolder("project")
        File(root, ".codepocket").mkdirs()
        File(root, ".codepocket/rules.md").writeText("测试必须通过。")
        val rules = ProjectRules.read(LocalWorkspace(root))

        assertTrue(rules!!.contains("测试必须通过"))
        assertTrue(rules.contains(".codepocket/rules.md"))
    }

    @Test
    fun `reads project skills`() {
        val root = temp.newFolder("project")
        File(root, ".codepocket/skills").mkdirs()
        File(root, ".codepocket/skills/python.md").writeText("改完 Python 必须跑 unittest。")
        val rules = ProjectRules.read(LocalWorkspace(root))

        assertTrue(rules!!.contains("改完 Python 必须跑 unittest"))
        assertTrue(rules.contains(".codepocket/skills/python.md"))
    }

    @Test
    fun `returns null when no rules`() {
        assertNull(ProjectRules.read(LocalWorkspace(temp.newFolder("empty"))))
    }
}
