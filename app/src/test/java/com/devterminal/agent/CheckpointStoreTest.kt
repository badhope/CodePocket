package com.devterminal.agent

import com.devterminal.workspace.LocalWorkspace
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class CheckpointStoreTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `snapshot stores and restores file contents`() {
        val project = temp.newFolder("project")
        val storeDir = temp.newFolder("checkpoints")
        File(project, "src").mkdirs()
        val file = File(project, "src/main.py")
        file.writeText("old content\nline2")

        val workspace = LocalWorkspace(project)
        val store = CheckpointStore(storeDir, workspace)
        val checkpoint = store.snapshot("before patch", listOf("src/main.py"))

        assertEquals("before patch", checkpoint.label)
        assertEquals(listOf("src/main.py"), checkpoint.files)
        assertTrue(File(storeDir, "snapshots/${checkpoint.id}.tsv").isFile)

        file.writeText("new content\nline2")
        val restored = store.restore(checkpoint)

        assertEquals(1, restored)
        assertEquals("old content\nline2", file.readText())
        assertEquals(1, store.list().size)
    }

    @Test
    fun `snapshot deduplicates identical blobs`() {
        val project = temp.newFolder("project")
        val storeDir = temp.newFolder("checkpoints")
        File(project, "a.txt").writeText("same")
        File(project, "b.txt").writeText("same")

        val workspace = LocalWorkspace(project)
        val store = CheckpointStore(storeDir, workspace)
        val checkpoint = store.snapshot("two files", listOf("a.txt", "b.txt"))

        assertEquals(2, checkpoint.files.size)
        assertEquals(1, File(storeDir, "blobs").listFiles()?.count { it.isFile })
    }

    @Test
    fun `delete removes snapshot metadata`() {
        val project = temp.newFolder("project")
        val storeDir = temp.newFolder("checkpoints")
        File(project, "a.txt").writeText("a")
        val store = CheckpointStore(storeDir, LocalWorkspace(project))
        val checkpoint = store.snapshot("x", listOf("a.txt"))

        store.delete(checkpoint.id)

        assertTrue(store.list().isEmpty())
    }

    @Test
    fun `snapshot rejects files outside workspace`() {
        val project = temp.newFolder("project")
        val storeDir = temp.newFolder("checkpoints")
        val store = CheckpointStore(storeDir, LocalWorkspace(project))

        org.junit.Assert.assertThrows(SecurityException::class.java) {
            store.snapshot("escape", listOf("../outside.txt"))
        }
    }
}
