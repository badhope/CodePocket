package com.devterminal.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.devterminal.language.ProjectSymbolIndex
import com.devterminal.ui.theme.CodePocketTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], qualifiers = "w360dp-h640dp-xhdpi")
class ReferenceDialogTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun `显示引用数量、位置与文本级说明`() {
        var picked: ProjectSymbolIndex.Reference? = null
        compose.setContent {
            CodePocketTheme {
                ReferenceDialog(
                    query = "helper",
                    matches = listOf(
                        ProjectSymbolIndex.Reference(
                            path = "utils.py", name = "helper", line = 3, column = 5,
                            preview = "def helper():", isDefinition = true,
                        ),
                        ProjectSymbolIndex.Reference(
                            path = "main.py", name = "helper", line = 9, column = 2,
                            preview = "helper()", isDefinition = false,
                        ),
                    ),
                    loading = false,
                    onPick = { picked = it },
                    onDismiss = {},
                )
            }
        }

        compose.onNodeWithText("“helper”的引用（2）").assertIsDisplayed()
        compose.onNodeWithText("文本级结果：包含注释、字符串和同名局部变量；按当前文件优先排序。")
            .assertIsDisplayed()
        compose.onNodeWithText("utils.py").assertIsDisplayed()
        compose.onNodeWithText("L3:5").assertIsDisplayed()
        compose.onNodeWithText("utils.py").performClick()
        compose.waitForIdle()
        assertTrue(picked?.path == "utils.py")
    }

    @Test
    fun `空结果时提示索引边界`() {
        compose.setContent {
            CodePocketTheme {
                ReferenceDialog(
                    query = "missing",
                    matches = emptyList(),
                    loading = false,
                    onPick = {},
                    onDismiss = {},
                )
            }
        }

        compose.onNodeWithText(
            "没有找到引用。只支持 Python 项目文件，索引上限 300 个 .py；这是文本匹配，不解析作用域。",
        ).assertIsDisplayed()
    }
}
