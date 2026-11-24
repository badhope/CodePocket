package com.devterminal.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
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
 * 终端对话框。默认是轻量命令会话：每条命令独立执行，保留项目内 cwd；
 * 打开「PTY 交互模式」后切到原生 forkpty 后端，可运行 vim/top 这类需要 tty 的程序，
 * 但 UI 只按行展示输出，不解释 ANSI 光标定位。输入框为空时发送不会发空命令。
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
    /** 真实 PTY 后端（forkpty + sh -i），不解释 ANSI 光标定位 */
    pty: Boolean = false,
    ptyRunning: Boolean = false,
    onTogglePty: (Boolean) -> Unit = {},
) {
    val listState = rememberLazyListState()
    LaunchedEffect(lines.size, busy) {
        if (lines.isNotEmpty()) runCatching { listState.animateScrollToItem(lines.size - 1) }
    }

    QuietDialog(
        onDismiss = onDismiss,
        title = "终端",
        confirmLabel = if (!busy && input.isNotBlank()) (if (pty) "发送" else "执行") else null,
        onConfirm = if (!busy && input.isNotBlank()) onRun else null,
    ) {
        Text(
            "工作目录：$cwd${if (pty) " · PTY 后端" else ""}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.muted,
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "PTY 交互模式（vim / top）",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                modifier = Modifier.weight(1f),
            )
            Switch(
                checked = pty,
                onCheckedChange = onTogglePty,
                enabled = !busy,
            )
        }
        if (pty) {
            Text(
                "真实伪终端：isatty 为真、支持交互 shell；不是 ANSI 终端模拟器，全屏程序的光标定位与颜色会被剥离/按行显示。",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.muted,
            )
        }
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
                if (pty && ptyRunning) {
                    item {
                        MonoText("● PTY 运行中", fontSize = 11, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
        Column(Modifier.fillMaxWidth()) {
            TextButton(onClick = onClear, enabled = !busy || pty) {
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
                placeholder = when {
                    busy -> "等待上一条命令…"
                    pty -> "输入命令，回车发送到 PTY"
                    else -> "输入命令"
                },
                mono = true,
                enabled = !busy,
                imeAction = ImeAction.Send,
                onImeAction = { if (input.isNotBlank() && !busy) onRun() },
            )
        }
    }
}
