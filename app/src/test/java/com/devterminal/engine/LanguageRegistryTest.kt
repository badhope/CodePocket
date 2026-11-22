package com.devterminal.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LanguageRegistryTest {

    @Test
    fun `has three runnable languages`() {
        assertEquals(3, LanguageRegistry.runnable.size)
        assertEquals(
            setOf("python", "javascript", "lua"),
            LanguageRegistry.runnable.map { it.id }.toSet()
        )
        assertTrue(LanguageRegistry.runnable.all { it.isRunnable })
    }

    @Test
    fun `has seventeen editable languages`() {
        assertEquals(17, LanguageRegistry.editable.size)
        assertTrue(LanguageRegistry.editable.none { it.isRunnable })
    }

    @Test
    fun `maps extensions to the right language`() {
        assertEquals("python", LanguageRegistry.forFile(java.io.File("main.py")).id)
        assertEquals("javascript", LanguageRegistry.forFile(java.io.File("app.mjs")).id)
        assertEquals("lua", LanguageRegistry.forFile(java.io.File("main.lua")).id)
        assertEquals("java", LanguageRegistry.forFile(java.io.File("Main.java")).id)
        assertEquals("text", LanguageRegistry.forFile(java.io.File("README")).id)
    }

    @Test
    fun `legacy project marker is migrated`() {
        assertEquals("python", LanguageRegistry.migrateLegacyId("PYTHON"))
        assertEquals("java", LanguageRegistry.migrateLegacyId("JAVA"))
        assertEquals("javascript", LanguageRegistry.migrateLegacyId("javascript"))
    }
}
