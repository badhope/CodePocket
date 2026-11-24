package com.devterminal.language

import com.devterminal.workspace.LocalWorkspace
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class ProjectSymbolIndexTest {
    @get:Rule
    val temp = TemporaryFolder()

    private fun project(): File = temp.newFolder("project")

    @Test
    fun `wordAt extracts identifier under cursor`() {
        val root = project()
        File(root, "main.py").writeText("value = helper(1)\n")
        val index = ProjectSymbolIndex(LocalWorkspace(root))

        assertEquals("helper", index.wordAt("value = helper(1)\n", 1, 10))
        assertEquals("value", index.wordAt("value = helper(1)\n", 1, 3))
        assertEquals(null, index.wordAt("value = helper(1)\n", 1, 6))
    }

    @Test
    fun `finds cross file definitions and ranks imported module first`() {
        val root = project()
        File(root, "main.py").writeText(
            """
            from utils import helper

            def main():
                helper()
            """.trimIndent(),
        )
        File(root, "utils.py").writeText("def helper():\n    return 1\n")
        File(root, "other.py").writeText("def helper():\n    return 2\n")

        val matches = ProjectSymbolIndex(LocalWorkspace(root)).find("helper", "main.py")

        assertEquals(2, matches.size)
        assertEquals("utils.py", matches.first().path)
        assertEquals(1, matches.first().line)
        assertEquals("函数", matches.first().kind)
    }

    @Test
    fun `same file definition ranks before other files`() {
        val root = project()
        File(root, "main.py").writeText("def helper():\n    pass\n")
        File(root, "utils.py").writeText("def helper():\n    pass\n")

        val matches = ProjectSymbolIndex(LocalWorkspace(root)).find("helper", "main.py")

        assertEquals("main.py", matches.first().path)
    }

    @Test
    fun `parse collects classes functions and module level variables`() {
        val root = project()
        File(root, "model.py").writeText(
            """
            VERSION = "1"

            class Store:
                def load(self):
                    local = 1
                    return local

            async def boot():
                pass
            """.trimIndent(),
        )

        val defs = ProjectSymbolIndex(LocalWorkspace(root)).parse(
            "model.py",
            File(root, "model.py").readText(),
        )

        assertTrue(defs.any { it.name == "VERSION" && it.kind == "变量" })
        assertTrue(defs.any { it.name == "Store" && it.kind == "类" })
        assertTrue(defs.any { it.name == "load" && it.kind == "函数" })
        assertTrue(defs.any { it.name == "boot" && it.kind == "函数" })
        assertTrue(defs.none { it.name == "local" })
    }

    @Test
    fun `non python files are ignored`() {
        val root = project()
        File(root, "main.py").writeText("def helper():\n    pass\n")
        File(root, "notes.txt").writeText("def helper():\n    pass\n")

        val matches = ProjectSymbolIndex(LocalWorkspace(root)).find("helper", "main.py")

        assertEquals(1, matches.size)
        assertEquals("main.py", matches.first().path)
    }
}
