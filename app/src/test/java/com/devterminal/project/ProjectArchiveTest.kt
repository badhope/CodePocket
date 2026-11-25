package com.devterminal.project

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class ProjectArchiveTest {

    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `exports source files and imports them without git or build noise`() {
        val project = temp.newFolder("demo")
        File(project, "src").mkdirs()
        File(project, "src/main.py").writeText("print('hi')\n")
        File(project, "README.md").writeText("# demo\n")
        File(project, ".devterminal").writeText("python")
        // 这些不应该进包
        File(project, ".git").mkdirs()
        File(project, ".git/config").writeText("secret")
        File(project, "build").mkdirs()
        File(project, "build/out.txt").writeText("noise")
        File(project, "__pycache__").mkdirs()
        File(project, "__pycache__/x.pyc").writeText("noise")

        val zip = ByteArrayOutputStream()
        val summary = ProjectArchive.export(project, zip)
        assertEquals(3, summary.files)

        val root = temp.newFolder("projects")
        val imported = ProjectArchive.import(ByteArrayInputStream(zip.toByteArray()), root, "demo-copy")
        assertEquals("demo-copy", imported.name)
        assertEquals("print('hi')\n", File(imported, "src/main.py").readText())
        assertEquals("# demo\n", File(imported, "README.md").readText())
        assertEquals("python", File(imported, ".devterminal").readText())
        assertFalse(File(imported, ".git").exists())
        assertFalse(File(imported, "build").exists())
    }

    @Test
    fun `rejects zip slip entries`() {
        val zip = ByteArrayOutputStream()
        ZipOutputStream(zip).use { out ->
            out.putNextEntry(ZipEntry("../evil.txt"))
            out.write("pwned".toByteArray())
            out.closeEntry()
        }
        val root = temp.newFolder("projects")
        var failed = false
        try {
            ProjectArchive.import(ByteArrayInputStream(zip.toByteArray()), root, "bad")
        } catch (e: IllegalArgumentException) {
            failed = true
        }
        assertTrue(failed)
        assertFalse(File(root.parentFile, "evil.txt").exists())
        assertTrue(root.listFiles().isNullOrEmpty())
    }

    @Test
    fun `single top level folder becomes the project root`() {
        val zip = ByteArrayOutputStream()
        ZipOutputStream(zip).use { out ->
            out.putNextEntry(ZipEntry("wrapped/main.py"))
            out.write("print(1)\n".toByteArray())
            out.closeEntry()
        }
        val root = temp.newFolder("projects")
        val imported = ProjectArchive.import(ByteArrayInputStream(zip.toByteArray()), root, "")
        assertEquals("wrapped", imported.name)
        assertEquals("print(1)\n", File(imported, "main.py").readText())
        assertFalse(File(imported, "wrapped").exists())
    }

    @Test
    fun `importing the same name twice gets a suffix`() {
        val zip = ByteArrayOutputStream()
        ZipOutputStream(zip).use { out ->
            out.putNextEntry(ZipEntry("main.py"))
            out.write("print(1)\n".toByteArray())
            out.closeEntry()
        }
        val root = temp.newFolder("projects")
        val first = ProjectArchive.import(ByteArrayInputStream(zip.toByteArray()), root, "same")
        val second = ProjectArchive.import(ByteArrayInputStream(zip.toByteArray()), root, "same")
        assertEquals("same", first.name)
        assertEquals("same-1", second.name)
    }
}
