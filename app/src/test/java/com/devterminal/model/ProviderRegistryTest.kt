package com.devterminal.model

import com.devterminal.settings.AppSettings
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ProviderRegistryTest {
    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `cloud without config is unavailable`() {
        val registry = ProviderRegistry(ModelRepository(temp.newFolder("models")))
        assertTrue(registry.resolve(AppSettings()) is AgentProviderChoice.Unavailable)
    }

    @Test
    fun `cloud with config is ready`() {
        val registry = ProviderRegistry(ModelRepository(temp.newFolder("models")))
        val choice = registry.resolve(AppSettings(aiConfigured = true))
        assertTrue(choice is AgentProviderChoice.Ready && !choice.usesLocal)
    }

    @Test
    fun `local without model is unavailable`() {
        val registry = ProviderRegistry(ModelRepository(temp.newFolder("models")))
        val choice = registry.resolve(AppSettings(useLocalModel = true))
        assertTrue(choice is AgentProviderChoice.Unavailable)
    }

    @Test
    fun `unknown local id is unavailable`() {
        val registry = ProviderRegistry(ModelRepository(temp.newFolder("models")))
        val choice = registry.resolve(
            AppSettings(useLocalModel = true, localModelId = "not-a-model"),
        )
        assertTrue(choice is AgentProviderChoice.Unavailable)
    }
}
