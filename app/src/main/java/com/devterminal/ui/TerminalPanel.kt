package com.devterminal.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietDialog
import com.devterminal.ui.components.QuietTextField
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.muted

/**
 * 轻量命令终端：不是 PTY，不接管全屏交互程序；每条命令独立执行，
 * 工作目录在当前项目内连续保留。输入框为空时按发送不会发空命令。
 */
@Composable
fun TerminalDialog(
    lines: List<TerminalLine>,
    cwd: String,
    busy: Boolean,
    input: String,
    onInputChange: (String) -> Unit,
    onRun: () -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit,
) {
    val listState = rememberLazyListState()
    LaunchedEffect(lines.size, busy) {
        if (lines.isNotEmpty()) runCatching { listState.animateScrollToItem(lines.size - 1) }
    }

    QuietDialog(
        onDismiss = onDismiss,
        title = "终端",
        confirmLabel = if (!busy && input.isNotBlank()) "执行" else null,
        onConfirm = if (!busy && input.isNotBlank()) onRun else null,
    ) {
        Text(
            "工作目录：$cwd",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.muted,
        )
        Spacer(Modifier.height(Dimens.sm))
        Box(Modifier.fillMaxWidth().height(300.dp)) {
            if (lines.isEmpty()) {
                Text(
                    "输入命令开始，例如 ls、python main.py、git status。",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.muted,
                    modifier = Modifier.align(Alignment.Center),
                )
            }
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxWidth().fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                items(lines) { line ->
                    MonoText(
                        line.text,
                        fontSize = 11,
                        color = if (line.command) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.78f),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 1.dp),
                    )
                }
                if (busy) {
                    item {
                        MonoText("… 正在执行", fontSize = 11, color = MaterialTheme.colorScheme.muted)
                    }
                }
            }
        }
        Column(Modifier.fillMaxWidth()) {
            TextButton(onClick = onClear, enabled = !busy) {
                Text(
                    "清屏",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.muted,
                )
            }
            QuietTextField(
                value = input,
                onValueChange = onInputChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = if (busy) "等待上一条命令…" else "输入命令",
                mono = true,
                enabled = !busy,
                imeAction = ImeAction.Send,
                onImeAction = { if (input.isNotBlank() && !busy) onRun() },
            )
        }
    }
}
