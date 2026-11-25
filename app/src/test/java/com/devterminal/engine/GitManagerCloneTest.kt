package com.devterminal.engine

import org.eclipse.jgit.api.Git
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class GitManagerCloneTest {

    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `clones a local repository into a new project directory`() {
        val source = temp.newFolder("source")
        Git.init().setDirectory(source).setInitialBranch("main").call().use { g ->
            File(source, "main.py").writeText("print('clone')\n")
            g.add().addFilepattern(".").call()
            g.commit()
                .setMessage("initial")
                .setAuthor("tester", "tester@example.com")
                .call()
        }

        val target = File(temp.root, "cloned")
        val result = GitManager().cloneInto(target, source.toURI().toString())

        assertTrue(result, result.startsWith("已克隆"))
        assertTrue(File(target, ".git").isDirectory)
        assertEquals("print('clone')\n", File(target, "main.py").readText())
        Git.open(target).use { assertEquals("main", it.repository.branch) }
    }

    @Test
    fun `refuses to clone into a non-empty directory`() {
        val target = temp.newFolder("occupied")
        File(target, "keep.txt").writeText("do not touch")
        val result = GitManager().cloneInto(target, "https://example.com/x.git")
        assertTrue(result.contains("不是空目录"))
        assertEquals("do not touch", File(target, "keep.txt").readText())
    }
}
