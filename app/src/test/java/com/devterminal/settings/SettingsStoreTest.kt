package com.devterminal.settings

import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SettingsStoreTest {

    @Test
    fun `保存后敏感与非敏感字段都能读回`() {
        val store = SettingsStore(ApplicationProvider.getApplicationContext())
        val saved = AppSettings(
            themeMode = ThemeModes.LIGHT,
            editorFontSize = 18,
            autoSave = false,
            timeoutSeconds = 45,
            outputHeightDp = 300,
            aiBaseUrl = "https://example.invalid/v1",
            aiApiKey = "sk-test-secret",
            aiConfigured = true,
            gitRemoteUrl = "https://user:token@example.invalid/repo.git",
            mcpEndpoint = "https://example.invalid/mcp",
            pluginsEnabled = true,
            agentPlanFirst = true
        )
        store.save(saved)
        store.flushWrites()
        val loaded = store.load()
        assertEquals(ThemeModes.LIGHT, loaded.themeMode)
        assertEquals(18, loaded.editorFontSize)
        assertFalse(loaded.autoSave)
        assertEquals(45, loaded.timeoutSeconds)
        assertEquals(300, loaded.outputHeightDp)
        assertEquals("https://example.invalid/v1", loaded.aiBaseUrl)
        assertEquals("sk-test-secret", loaded.aiApiKey)
        assertEquals("https://user:token@example.invalid/repo.git", loaded.gitRemoteUrl)
        assertEquals("https://example.invalid/mcp", loaded.mcpEndpoint)
        assertEquals(true, loaded.pluginsEnabled)
        assertEquals(true, loaded.agentPlanFirst)
    }

    @Test
    fun `连续保存只保留最后一版敏感值`() {
        val store = SettingsStore(ApplicationProvider.getApplicationContext())
        repeat(30) { i ->
            store.save(AppSettings(aiApiKey = "key-$i", mcpEndpoint = "https://mcp/$i"))
        }
        store.flushWrites()
        val loaded = store.load()
        assertEquals("key-29", loaded.aiApiKey)
        assertEquals("https://mcp/29", loaded.mcpEndpoint)
    }
}
