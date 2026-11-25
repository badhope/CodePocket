package com.devterminal.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.devterminal.ui.theme.CodePocketTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w360dp-h640dp-xhdpi")
class EditorTopBarTest {

    @get:Rule
    val compose = createComposeRule()

    private fun topBar(compact: Boolean) {
        compose.setContent {
            CodePocketTheme {
                EditorTopBar(
                    fileName = "main.py",
                    dirty = false,
                    languageLabel = "Python",
                    isRunnable = true,
                    canRun = true,
                    isPython = true,
                    previewable = true,
                    previewVisible = false,
                    running = false,
                    compact = compact,
                    onOpenDrawer = {},
                    onSave = {},
                    onStop = {},
                    onRun = {},
                    onDebug = {},
                    onPalette = {},
                    onPreview = {},
                )
            }
        }
    }

    @Test
    fun `紧凑顶栏把预览收进更多`() {
        topBar(compact = true)
        compose.onNodeWithContentDescription("更多操作").assertIsDisplayed()
        compose.onNodeWithContentDescription("实时预览").assertDoesNotExist()
        compose.onNodeWithContentDescription("更多操作").performClick()
        compose.onNodeWithText("实时预览").assertIsDisplayed()
        compose.onNodeWithText("命令面板").assertIsDisplayed()
    }

    @Test
    fun `宽屏顶栏保留预览入口`() {
        topBar(compact = false)
        compose.onNodeWithContentDescription("实时预览").assertIsDisplayed()
        compose.onNodeWithContentDescription("更多操作").assertDoesNotExist()
    }
}
