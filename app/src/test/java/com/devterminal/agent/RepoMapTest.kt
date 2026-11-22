package com.devterminal.agent

import com.devterminal.workspace.LocalWorkspace
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class RepoMapTest {
    @get:Rule
    val temp = TemporaryFolder()

    private fun workspace(): LocalWorkspace {
        val root = temp.newFolder("project")
        File(root, "src").mkdirs()
        File(root, "src/LoginScreen.kt").writeText(
            """
            package demo
            class LoginScreen {
                fun submit() {}
            }
            """.trimIndent(),
        )
        File(root, "src/Cart.kt").writeText(
            """
            package demo
            class Cart {
                fun total() = 0
            }
            """.trimIndent(),
        )
        File(root, "README.md").writeText("# Demo\n")
        return LocalWorkspace(root)
    }

    @Test
    fun `builds a task-ranked map with symbols`() {
        val map = RepoMapBuilder(workspace()).build("修复登录页 LoginScreen 的提交", maxChars = 1200)

        assertTrue(map.text.contains("LoginScreen.kt"))
        assertTrue(map.text.contains("LoginScreen"))
        assertTrue(map.text.contains("submit"))
        assertEquals(3, map.totalFiles)
    }

    @Test
    fun `respects character budget`() {
        val map = RepoMapBuilder(workspace()).build("cart", maxChars = 200, maxFiles = 20)

        assertTrue(map.text.length <= 230)
        assertTrue(map.text.contains("Cart.kt"))
    }

    @Test
    fun `empty project returns explanatory map`() {
        val root = temp.newFolder("empty")
        val map = RepoMapBuilder(LocalWorkspace(root)).build("anything")

        assertTrue(map.isEmpty)
        assertTrue(map.text.contains("未发现"))
    }
}
