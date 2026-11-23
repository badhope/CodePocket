package com.devterminal.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class TerminalSessionTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `runs commands and keeps cwd inside project`() {
        val root = temp.newFolder("project")
        val sub = File(root, "src").apply { mkdirs() }
        val session = TerminalSession(root)

        assertTrue(session.execute("cd src").ok)
        assertEquals(sub.canonicalPath, session.cwd.canonicalPath)
        assertTrue(session.execute("printf hello").output.contains("hello"))
        assertTrue(session.execute("cd ..").ok)
        assertEquals(root.canonicalPath, session.cwd.canonicalPath)
        assertFalse(session.execute("cd ..").ok)
        assertTrue(session.execute("pwd").output.contains(root.canonicalPath))
    }

    @Test
    fun `blank command is no-op`() {
        val session = TerminalSession(temp.newFolder("project2"))
        assertTrue(session.execute("   ").ok)
    }
}
