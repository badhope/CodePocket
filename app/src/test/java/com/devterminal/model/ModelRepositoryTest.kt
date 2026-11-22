package com.devterminal.model

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class ModelRepositoryTest {
    @get:Rule
    val temp = TemporaryFolder()

    private fun spec(size: Long, hash: String) = LocalModelSpec(
        id = "test",
        displayName = "Test",
        fileName = "test.gguf",
        sizeBytes = size,
        sha256 = hash,
        url = "https://example.com/test.gguf",
        minRamGb = 6,
        params = "1B",
        quantization = "Q4",
        licenseName = "Apache-2.0",
        licenseUrl = "https://example.com",
        note = "test",
    )

    @Test
    fun `installed requires size and verified marker`() {
        val dir = temp.newFolder("models")
        val repo = ModelRepository(dir)
        val s = spec(3, "abc")
        File(dir, "test.gguf").writeText("123")

        assertFalse(repo.isInstalled(s))
        File(dir, "test.gguf.sha256").writeText("abc")
        assertTrue(repo.isInstalled(s))
    }

    @Test
    fun `delete removes model part and marker`() {
        val dir = temp.newFolder("models")
        val repo = ModelRepository(dir)
        val s = spec(3, "abc")
        File(dir, "test.gguf").writeText("123")
        File(dir, "test.gguf.part").writeText("pa")
        File(dir, "test.gguf.sha256").writeText("abc")

        assertTrue(repo.delete(s))
        assertFalse(File(dir, "test.gguf").exists())
        assertFalse(File(dir, "test.gguf.part").exists())
        assertFalse(File(dir, "test.gguf.sha256").exists())
    }
}
