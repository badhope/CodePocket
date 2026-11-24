package com.devterminal.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
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
 * 跨文件定义候选。
 *
 * 不自动替用户选：同名函数在多个模块里出现是常态，
 * 猜错一次就会把光标带到完全无关的文件，比不跳更糟。
 */
@Composable
fun DefinitionDialog(
    query: String,
    matches: List<ProjectSymbolIndex.Definition>,
    loading: Boolean,
    onPick: (ProjectSymbolIndex.Definition) -> Unit,
    onDismiss: () -> Unit,
) {
    QuietDialog(
        onDismiss = onDismiss,
        title = if (query.isBlank()) "跳转到定义" else "“$query”的定义",
    ) {
        when {
            loading -> Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = Dimens.lg),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(modifier = Modifier.width(18.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(Dimens.sm))
                Text("扫描项目中…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.muted)
            }

            matches.isEmpty() -> QuietHint("没有找到定义。只支持 Python 项目文件，且索引上限为 300 个 .py。")

            else -> Column {
                matches.forEach { definition ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPick(definition) }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                definition.name,
                                style = MaterialTheme.typography.bodyMedium,
                                maxLines = 1,
                            )
                            Text(
                                definition.signature.ifBlank { definition.kind },
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.muted,
                                maxLines = 1,
                            )
                            Text(
                                definition.path,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.muted,
                                maxLines = 1,
                            )
                        }
                        Text(
                            "L${definition.line}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        }
    }
}
