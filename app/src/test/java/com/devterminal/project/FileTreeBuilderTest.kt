package com.devterminal.project

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class FileTreeBuilderTest {

    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun `预算充足时不标记截断`() {
        val dir = tmp.newFolder("proj")
        File(dir, "a.py").writeText("a")
        File(dir, "b.py").writeText("b")

        val tree = buildFileTree(dir, budget = intArrayOf(20))
        assertFalse(tree.truncated)
        assertTrue(tree.children.any { it.name == "a.py" })
        assertTrue(tree.children.any { it.name == "b.py" })
    }

    @Test
    fun `预算耗尽时标记截断且不伪造完整树`() {
        val dir = tmp.newFolder("proj")
        repeat(20) { File(dir, "f$it.py").writeText("x") }

        val tree = buildFileTree(dir, budget = intArrayOf(4))
        assertTrue(tree.truncated)
        assertTrue(tree.children.size < 20)
    }

    @Test
    fun `子目录截断会向根传播`() {
        val dir = tmp.newFolder("proj")
        val sub = File(dir, "sub").apply { mkdirs() }
        repeat(20) { File(sub, "f$it.py").writeText("x") }

        val tree = buildFileTree(dir, budget = intArrayOf(5))
        assertTrue(tree.truncated)
        assertTrue(tree.children.first { it.name == "sub" }.truncated)
    }

    @Test
    fun `深层目录达到深度上限时也标记截断`() {
        val dir = tmp.newFolder("proj")
        var cur = dir
        repeat(3) { i ->
            cur = File(cur, "d$i").apply { mkdirs() }
            File(cur, "x.py").writeText("x")
        }

        val tree = buildFileTree(dir, budget = intArrayOf(100), maxDepth = 1)
        assertTrue(tree.truncated)
    }
}
