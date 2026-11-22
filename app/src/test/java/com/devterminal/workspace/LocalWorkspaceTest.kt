package com.devterminal.workspace

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class LocalWorkspaceTest {
    @get:Rule
    val temp = TemporaryFolder()

    private lateinit var root: File
    private lateinit var workspace: LocalWorkspace

    private fun setUpProject() {
        root = temp.newFolder("project")
        workspace = LocalWorkspace(root)

        File(root, "src").mkdirs()
        File(root, "src/main.py").writeText(
            """
            line1
            line2
            line3
            line4
            line5
            """.trimIndent()
        )
        File(root, "build").mkdirs()
        File(root, "build/generated.txt").writeText("should be skipped")
        File(root, "src/readme.md").writeText("needle here\nsecond needle")
        File(root, "src/empty.py").writeText("")
        File(root, "src/blob.bin").writeBytes(byteArrayOf(1, 0, 2, 3))
    }

    @Test
    fun `readText returns a bounded numbered window`() {
        setUpProject()
        val window = workspace.readText("src/main.py", startLine = 2, maxLines = 2)

        assertEquals("src/main.py", window.path)
        assertEquals(2, window.startLine)
        assertEquals(3, window.endLine)
        assertEquals(5, window.totalLines)
        assertEquals("line2\nline3", window.content)
        assertTrue(window.truncated)
        assertEquals("2\tline2\n3\tline3", window.numbered())
    }

    @Test
    fun `readText rejects binary files`() {
        setUpProject()
        assertThrows(IllegalArgumentException::class.java) {
            workspace.readText("src/blob.bin")
        }
    }

    @Test
    fun `resolve blocks parent traversal and absolute escapes`() {
        setUpProject()
        assertThrows(SecurityException::class.java) {
            workspace.resolve("../outside.txt")
        }
        assertThrows(SecurityException::class.java) {
            workspace.resolve("/etc/passwd")
        }
        assertEquals(File(root, "src/main.py").canonicalFile, workspace.resolve("src/main.py"))
    }

    @Test
    fun `writeBytes creates nested files and is visible to readText`() {
        setUpProject()
        workspace.writeBytes("new/dir/file.txt", "hello".toByteArray())
        assertEquals("hello", workspace.readText("new/dir/file.txt").content)
    }

    @Test
    fun `replaceLines replaces an inclusive range`() {
        setUpProject()
        val window = workspace.replaceLines("src/main.py", 2, 3, "x\ny")

        assertEquals(listOf("line1", "x", "y", "line4", "line5"), File(root, "src/main.py").readLines())
        assertTrue(window.content.contains("x"))
        assertTrue(window.content.contains("y"))
    }

    @Test
    fun `replaceLines can insert at end`() {
        setUpProject()
        workspace.replaceLines("src/main.py", 6, 5, "line6")
        assertEquals(6, File(root, "src/main.py").readLines().size)
        assertEquals("line6", File(root, "src/main.py").readLines().last())
    }

    @Test
    fun `listFiles skips build and node_modules`() {
        setUpProject()
        File(root, "node_modules/pkg").mkdirs()
        File(root, "node_modules/pkg/index.js").writeText("no")
        val files = workspace.listFiles(maxDepth = 5, maxEntries = 100)

        assertTrue(files.contains("src/main.py"))
        assertFalse(files.contains("build/generated.txt"))
        assertFalse(files.contains("node_modules/pkg/index.js"))
    }

    @Test
    fun `search respects glob and result limit`() {
        setUpProject()
        val hits = workspace.search("needle", glob = "*.md", maxResults = 10)
        assertEquals(2, hits.size)
        assertTrue(hits.all { it.path == "src/readme.md" })
        assertTrue(hits.all { it.text.contains("needle", ignoreCase = true) })

        val limited = workspace.search("needle", glob = "*.md", maxResults = 1)
        assertEquals(1, limited.size)
    }

    @Test
    fun `empty file returns an empty window`() {
        setUpProject()
        val window = workspace.readText("src/empty.py")
        assertEquals(0, window.totalLines)
        assertEquals("", window.content)
        assertFalse(window.truncated)
    }
}
