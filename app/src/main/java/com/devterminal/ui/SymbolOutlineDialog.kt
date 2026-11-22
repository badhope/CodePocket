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
import com.devterminal.language.CodeSymbol
import com.devterminal.ui.components.QuietDialog
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.muted

/**
 * 当前文件符号大纲。点击一行跳到对应行，替代在几百行里滚动找函数。
 * 这是 LanguageService 的第一层 UI 契约：只读、零网络、零索引。
 */
@Composable
fun SymbolOutlineDialog(
    fileName: String,
    symbols: List<CodeSymbol>,
    loading: Boolean,
    onPick: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    QuietDialog(
        onDismiss = onDismiss,
        title = "符号大纲 · $fileName",
    ) {
        when {
            loading -> Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = Dimens.lg),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(modifier = Modifier.width(18.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(Dimens.sm))
                Text("扫描中…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.muted)
            }

            symbols.isEmpty() -> QuietHint("没有识别到类或函数。支持 Python / Kotlin / Java / JS / TS / Lua。")

            else -> Column {
                symbols.forEach { symbol ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPick(symbol.line) }
                            .padding(vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                symbol.name,
                                style = MaterialTheme.typography.bodyMedium,
                                maxLines = 1,
                            )
                            if (symbol.signature.isNotBlank() && symbol.signature != symbol.name) {
                                Text(
                                    symbol.signature,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.muted,
                                    maxLines = 1,
                                )
                            }
                        }
                        Text(
                            symbol.kind,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.muted,
                        )
                        Spacer(Modifier.width(Dimens.sm))
                        Text(
                            "L${symbol.line}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Spacer(Modifier.height(Dimens.sm))
            }
        }
    }
}
