package com.devterminal.language

import com.devterminal.workspace.LocalWorkspace
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class LanguageServiceTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `outline finds python classes and functions with line numbers`() {
        val root = temp.newFolder("project")
        File(root, "main.py").writeText(
            """
            import os

            class Greeter:
                def hello(self):
                    return "hi"

            def main():
                pass
            """.trimIndent(),
        )
        val symbols = LanguageService(LocalWorkspace(root)).outline("main.py")

        assertEquals(listOf("Greeter", "hello", "main"), symbols.map { it.name })
        assertEquals(listOf("类", "函数", "函数"), symbols.map { it.kind })
        assertTrue(symbols.all { it.line in 1..10 })
    }

    @Test
    fun `outline supports kotlin and javascript`() {
        val root = temp.newFolder("project")
        File(root, "A.kt").writeText("class A {\n  fun run() {}\n}\n")
        File(root, "app.js").writeText("class Store {}\nfunction boot() {}\n")
        val workspace = LocalWorkspace(root)
        val service = LanguageService(workspace)

        assertTrue(service.outline("A.kt").any { it.name == "A" })
        assertTrue(service.outline("A.kt").any { it.name == "run" })
        assertTrue(service.outline("app.js").any { it.name == "Store" })
        assertTrue(service.outline("app.js").any { it.name == "boot" })
    }

    @Test
    fun `unknown extension returns empty outline`() {
        val root = temp.newFolder("project")
        File(root, "notes.txt").writeText("class Fake\n")
        assertTrue(LanguageService(LocalWorkspace(root)).outline("notes.txt").isEmpty())
    }
}
