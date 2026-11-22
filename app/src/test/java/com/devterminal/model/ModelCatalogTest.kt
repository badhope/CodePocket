package com.devterminal.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelCatalogTest {

    @Test
    fun `catalog entries are complete and https`() {
        assertTrue(ModelCatalog.models.isNotEmpty())
        ModelCatalog.models.forEach { spec ->
            assertEquals(64, spec.sha256.length)
            assertTrue(spec.url.startsWith("https://"))
            assertTrue(spec.sizeBytes > 100_000_000)
            assertTrue(spec.minRamGb >= 6)
        }
        assertEquals(ModelCatalog.DEFAULT_ID, ModelCatalog.models.first().id)
    }
}
