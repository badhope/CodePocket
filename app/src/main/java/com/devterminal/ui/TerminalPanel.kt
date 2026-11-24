package com.devterminal.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.devterminal.ui.components.EdgeToEdgeDialog
import com.devterminal.ui.components.Hairline
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietTextField
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.muted
import kotlinx.coroutines.flow.Flow

/**
 * 终端面板。
 *
 * 0.0.30 起改成「全屏可伸缩」而不是固定 330dp 的对话框：
 *  - 终端主体用 weight(1f) 吃掉键盘上方的所有空间，软键盘弹起时自动变矮，
 *    不会把下方按键条顶出屏幕；
 *  - 头部、PTY 开关、按键条固定，正文和输入框各自占位；
 *  - 非 PTY 的命令输入框固定在底部，不再随长输出滚走。
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
    /** 真实 PTY 后端（forkpty + sh -i），输出由 xterm.js 渲染 */
    pty: Boolean = false,
    ptyRunning: Boolean = false,
    onTogglePty: (Boolean) -> Unit = {},
    ptyBytes: Flow<ByteArray>? = null,
    onPtyData: (String) -> Unit = {},
    onPtyResize: (Int, Int) -> Unit = { _, _ -> },
    onPtyKey: (String) -> Unit = {},
    darkTheme: Boolean = true,
) {
    val listState = rememberLazyListState()
    LaunchedEffect(lines.size, busy) {
        if (lines.isNotEmpty()) runCatching { listState.animateScrollToItem(lines.size - 1) }
    }

    // PTY 模式下「清屏」应该清 xterm 自己的备用屏；Ctrl-L 是 shell 的标准清屏序列。
    val clearAction: () -> Unit = if (pty) {
        { onPtyKey("\u000c") }
    } else {
        onClear
    }
    val clearEnabled = if (pty) ptyRunning else lines.isNotEmpty()

    EdgeToEdgeDialog(onDismiss = onDismiss) {
        Surface(
            modifier = Modifier
                .widthIn(max = 720.dp)
                .fillMaxWidth()
                .fillMaxHeight(),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            shadowElevation = 8.dp,
        ) {
            Column(Modifier.fillMaxSize()) {
                // ---------- 标题栏：固定，不参与滚动 ----------
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 18.dp, end = 4.dp, top = 8.dp, bottom = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "终端",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        MonoText(
                            "工作目录：$cwd${if (pty) " · PTY 后端" else ""}",
                            color = MaterialTheme.colorScheme.muted,
                            fontSize = 10,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    TextButton(onClick = clearAction, enabled = clearEnabled) {
                        Text("清屏", style = MaterialTheme.typography.labelSmall)
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "关闭终端",
                            tint = MaterialTheme.colorScheme.muted,
                        )
                    }
                }
                Hairline()

                // ---------- PTY 开关：固定 ----------
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 18.dp, vertical = 4.dp),
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
                        "真实伪终端 + 本地 xterm.js：支持 ANSI 颜色、光标定位与全屏重绘。点击终端区域唤起软键盘。",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.muted,
                        modifier = Modifier.padding(horizontal = 18.dp),
                    )
                    Spacer(Modifier.height(Dimens.sm))

                    // 主体自适应：键盘越大，终端越矮；不再固定 330dp。
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(horizontal = Dimens.md),
                    ) {
                        if (ptyBytes != null) {
                            PtyTerminalView(
                                bytes = ptyBytes,
                                onData = onPtyData,
                                onResize = onPtyResize,
                                darkTheme = darkTheme,
                            )
                        } else {
                            Text(
                                "PTY 输出通道未连接。",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.muted,
                                modifier = Modifier.align(Alignment.Center),
                            )
                        }
                    }

                    // ---------- 移动端补充键：固定贴在键盘上方 ----------
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState())
                            .padding(horizontal = Dimens.sm, vertical = 2.dp),
                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        listOf(
                            "Esc" to "\u001b",
                            "Tab" to "\t",
                            "Ctrl-C" to "\u0003",
                            "Ctrl-D" to "\u0004",
                            "←" to "\u001b[D",
                            "↑" to "\u001b[A",
                            "↓" to "\u001b[B",
                            "→" to "\u001b[C",
                        ).forEach { (label, key) ->
                            TextButton(
                                onClick = { onPtyKey(key) },
                                enabled = ptyRunning,
                                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                                    horizontal = 8.dp,
                                    vertical = 2.dp,
                                ),
                            ) {
                                Text(label, style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                    if (!ptyRunning) {
                        Text(
                            "PTY 未运行",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.muted,
                            modifier = Modifier.padding(horizontal = 18.dp, vertical = 2.dp),
                        )
                    }
                    Spacer(Modifier.height(Dimens.xs))
                } else {
                    // 命令输出占满剩余高度；输入框固定在底部。
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(horizontal = 18.dp),
                    ) {
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
                            modifier = Modifier.fillMaxSize(),
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
                                    MonoText(
                                        "… 正在执行",
                                        fontSize = 11,
                                        color = MaterialTheme.colorScheme.muted,
                                    )
                                }
                            }
                        }
                    }
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp)
                            .padding(bottom = Dimens.sm),
                    ) {
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
        }
    }
}
