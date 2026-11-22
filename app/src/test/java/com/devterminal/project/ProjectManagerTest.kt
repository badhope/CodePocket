package com.devterminal.project

import org.junit.Assert.assertEquals
import org.junit.Test

class ProjectManagerTest {

    @Test
    fun `keeps the dot in file names`() {
        assertEquals("main.py", sanitizeFileName("main.py"))
        assertEquals("app.mjs", sanitizeFileName("app.mjs"))
        assertEquals(".env", sanitizeFileName(".env"))
    }

    @Test
    fun `strips path separators instead of silently creating the wrong file`() {
        assertEquals("a_b.py", sanitizeFileName("a/b.py"))
        assertEquals("a_b.py", sanitizeFileName("a\\b.py"))
    }

    @Test
    fun `falls back for empty and dot names`() {
        assertEquals("untitled", sanitizeFileName(""))
        assertEquals("untitled", sanitizeFileName("   "))
        assertEquals("untitled", sanitizeFileName("."))
        assertEquals("untitled", sanitizeFileName(".."))
    }

    @Test
    fun `trims surrounding whitespace`() {
        assertEquals("main.py", sanitizeFileName("  main.py  "))
    }
}
