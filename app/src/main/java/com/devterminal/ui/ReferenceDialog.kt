package com.devterminal.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.devterminal.language.ProjectSymbolIndex
import com.devterminal.ui.components.QuietDialog
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.muted

/**
 * 项目级引用列表。
 *
 * 结果明确标注“文本级”：不做作用域/类型推断，也不会自动改名。
 * 每一条都显示文件、行号、列号和整行预览，用户自己判断是不是目标。
 */
@Composable
fun ReferenceDialog(
    query: String,
    matches: List<ProjectSymbolIndex.Reference>,
    loading: Boolean,
    onPick: (ProjectSymbolIndex.Reference) -> Unit,
    onDismiss: () -> Unit,
) {
    QuietDialog(
        onDismiss = onDismiss,
        title = if (query.isBlank()) "查找引用" else "“$query”的引用（${matches.size}）",
    ) {
        when {
            loading -> Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = Dimens.lg),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(modifier = Modifier.width(18.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(Dimens.sm))
                Text(
                    "扫描项目中…",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.muted,
                )
            }

            matches.isEmpty() -> QuietHint(
                "没有找到引用。只支持 Python 项目文件，索引上限 300 个 .py；这是文本匹配，不解析作用域。",
            )

            else -> Column {
                Text(
                    "文本级结果：包含注释、字符串和同名局部变量；按当前文件优先排序。",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.muted,
                )
                Spacer(Modifier.height(2.dp))
                matches.forEach { reference ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPick(reference) }
                            .padding(vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    reference.path,
                                    style = MaterialTheme.typography.bodySmall,
                                    maxLines = 1,
                                )
                                if (reference.isDefinition) {
                                    Text(
                                        "  定义",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary,
                                        maxLines = 1,
                                    )
                                }
                            }
                            Text(
                                reference.preview.ifBlank { "（空行）" },
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.muted,
                                maxLines = 2,
                            )
                        }
                        Text(
                            "L${reference.line}:${reference.column}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }
    }
}
