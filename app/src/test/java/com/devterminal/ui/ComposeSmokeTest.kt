package com.devterminal.ui

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.Density
import com.devterminal.project.FileNode
import com.devterminal.settings.AppSettings
import com.devterminal.ui.theme.CodePocketTheme
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w360dp-h640dp-xhdpi")
class ComposeSmokeTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun `文件树截断显示明确提示`() {
        val root = FileNode(
            name = "proj",
            path = "/proj",
            isDirectory = true,
            children = listOf(FileNode("main.py", "/proj/main.py", false)),
            truncated = true
        )
        compose.setContent {
            CodePocketTheme {
                FileTree(
                    root = root,
                    selectedPath = null,
                    onFileClick = {},
                    onFileLongPress = {}
                )
            }
        }
        compose.onNodeWithText("文件过多，仅显示前 10,000 项；完整列表请在终端查看。")
            .assertIsDisplayed()
        compose.onNodeWithText("main.py").assertIsDisplayed()
    }

    @Test
    fun `Git 差异对话框显示增删行`() {
        compose.setContent {
            CodePocketTheme {
                GitDiffDialog(
                    path = "main.py",
                    diff = "--- a/main.py\n+++ b/main.py\n-x = 1\n+x = 2\n",
                    loading = false,
                    onDismiss = {}
                )
            }
        }
        compose.onNodeWithText("差异 · main.py").assertIsDisplayed()
        compose.onNodeWithText("-x = 1\n+x = 2", substring = true).assertIsDisplayed()
    }

    @Test
    fun `设置页在 200 百分比字体缩放下可打开`() {
        compose.setContent {
            val density = LocalDensity.current
            CompositionLocalProvider(
                LocalDensity provides Density(density.density, fontScale = 2f)
            ) {
                CodePocketTheme {
                    SettingsDialog(
                        settings = AppSettings(),
                        onThemeModeChange = {},
                        onFontSizeChange = {},
                        onAutoSaveChange = {},
                        onTimeoutChange = {},
                        onEditorThemeChange = {},
                        onWordWrapChange = {},
                        onAutoCloseChange = {},
                        onShowLineNumbersChange = {},
                        onAiConfigChange = { _, _, _ -> },
                        onMcpConfigChange = { _, _ -> },
                        onPluginsEnabledChange = {},
                        onAgentPlanFirstChange = {},
                        onDismiss = {}
                    )
                }
            }
        }
        compose.onNodeWithText("设置").assertIsDisplayed()
        compose.onNodeWithText("切换文件时自动保存").assertIsDisplayed()
    }
}
