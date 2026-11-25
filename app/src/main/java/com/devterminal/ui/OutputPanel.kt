package com.devterminal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Stop

import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material.icons.outlined.Keyboard
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowLeft
import androidx.compose.material.icons.outlined.KeyboardArrowRight
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.style.TextOverflow
import kotlinx.coroutines.launch
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.components.QuietIconButton
import com.devterminal.ui.components.QuietTextField
import com.devterminal.ui.components.StatusDot
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.muted
import com.devterminal.ui.theme.success

/**
 * 从一行输出里解析出「文件:行号」中的行号，解析不到返回 null。
 *
 * 覆盖的格式（前两种是本 App 内置的编译器/解释器实际输出）：
 *  - Python：`  File "main.py", line 12, in <module>`
 *  - Java  ：`Main.java:12: error: ';' expected`
 *  - 通用  ：`main.py:12:5` / `./src/main.py:12`（多数 linter 与编译器风格）
 *
 * 只认行号，不校验文件是否等于当前文件——输出里的路径可能带 `./` 前缀
 * 或完整绝对路径，严格比对反而会漏掉大量真实命中。跳转目标是「当前打开的文件」，
 * 若报错来自其他文件，用户切过去后行号依然有意义。
 */
private val PY_TRACE = Regex("""line\s+(\d+)""")
private val PATH_LINE = Regex("""[\w./\\-]+\.\w{1,6}:(\d+)""")

internal fun parseErrorLine(line: String): Int? {
    // 已是友好提示或纯说明行，不参与跳转
    if (line.startsWith("💡") || line.startsWith("——")) return null

    // Python 的 `line 12` 最不容易与其他内容冲突，优先匹配
    PY_TRACE.find(line)?.let { m ->
        m.groupValues.getOrNull(1)?.toIntOrNull()?.let { return (it - 1).coerceAtLeast(0) }
    }
    // 其次匹配 `file.ext:12`；要求扩展名在前，避免误吞版本号（如 1.2.3）
    PATH_LINE.find(line)?.let { m ->
        m.groupValues.getOrNull(1)?.toIntOrNull()?.let { return (it - 1).coerceAtLeast(0) }
    }
    return null
}

/**
 * 底部输出面板。
 *
 * 两处实质改进：
 *  1. **改用 LazyColumn**：原来用 Column 一次性渲染全部输出行，跑一个每秒打印几百行的
 *     程序时，每来一行都要重绘整个列表，掉帧非常明显；现在只渲染可视区域。
 *  2. **头部去噪**：去掉「输出」标题和实心徽标，改为一个状态圆点 + 一行细字，
 *     操作收敛为三个无背景图标。
 */
@Composable
fun OutputPanel(
    output: List<String>,
    running: Boolean,
    exitCode: Int?,
    inputVisible: Boolean,
    inputDraft: String,
    onInputChange: (String) -> Unit,
    onInputSend: () -> Unit,
    onClear: () -> Unit,
    onRerun: () -> Unit,
    modifier: Modifier = Modifier,
    /** 运行中点底部「■ 停止」pill 时回调 */
    onStop: (() -> Unit)? = null,
    /** 用户在输出区点「点击输入」入口，展开 stdin 输入行并弹键盘 */
    onRequestInput: (() -> Unit)? = null,
    onShare: (() -> Unit)? = null,
    onCopy: (() -> Unit)? = null,
    /** 方向键/Tab 等特殊按键，发送对应转义序列给运行中的程序 */
    onSpecialKey: ((String) -> Unit)? = null,
    /**
     * 点击带行号的报错行时回调行号（0 基）。
     *
     * 这是「运行 → 看报错 → 改代码」闭环里最关键的一跳：
     * 原先报错行只是只读文本，用户得自己数行号再滚过去。
     */
    onJumpToLine: ((Int) -> Unit)? = null,
    /** pdb 调试中：显示快捷命令条 */
    debugging: Boolean = false,
    onDebugCommand: ((String) -> Unit)? = null,
    onDebugBreak: (() -> Unit)? = null,
    /** 停止 8 秒后引擎仍被 :engine 进程占用：显示「重启引擎」出口 */
    engineStuck: Boolean = false,
    onRestartEngine: (() -> Unit)? = null
) {
    val cs = MaterialTheme.colorScheme
    val listState = rememberLazyListState()
    val inputFocus = remember { FocusRequester() }
    val scope = rememberCoroutineScope()

    // 自动跟随锁：默认贴底；一旦用户在「不在底部」时主动滚动，就解除自动跟随，
    // 否则每来一行 animateScrollToItem 都会把用户正在看的历史输出一把拽回底部。
    var autoFollow by rememberSaveable { mutableStateOf(true) }
    // 是否已滚到最后一条：用可视窗口末项判断，避免用 totalCount 抖动
    val atBottom by remember {
        derivedStateOf {
            val info = listState.layoutInfo
            val last = info.visibleItemsInfo.lastOrNull()
            last != null && last.index >= info.totalItemsCount - 1
        }
    }
    LaunchedEffect(listState) {
        snapshotFlow { listState.isScrollInProgress }.collect { scrolling ->
            // 用户主动上翻离开底部 → 暂停自动跟随，把滚动权交还给用户
            if (scrolling && !atBottom) autoFollow = false
        }
    }
    // 有新输出且仍处于跟随态时，瞬时贴到最后一行（不再用动画，避免持续拖拽感）
    LaunchedEffect(output.size) {
        if (autoFollow && output.isNotEmpty()) {
            runCatching { listState.scrollToItem(output.size - 1) }
        }
    }
    // 运行开始后自动聚焦输入框，方便直接交互
    LaunchedEffect(inputVisible) {
        if (inputVisible) runCatching { inputFocus.requestFocus() }
    }
    // P1-1：每次新运行（running false→true）都复位自动跟随，避免上一轮用户上翻后
    // 这一轮新输出停在历史位置不贴底。
    LaunchedEffect(running) {
        if (running) autoFollow = true
    }

    Column(modifier = modifier.background(cs.background)) {
        // ---------- 主操作 pill（拇指区主操作：运行 / 停止） ----------
        // 输入行展开时先收起 40dp 大按钮：头部仍有「重新运行」图标，
        // 这样 220dp 的最小面板仍能同时容纳输出、输入框和方向键。
        if (!inputVisible) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (running) {
                Row(
                    Modifier
                        .height(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(cs.error.copy(alpha = 0.12f))
                        .clickable { onStop?.invoke() }
                        .padding(horizontal = 22.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.Stop, "停止", tint = cs.error,
                        modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("停止", color = cs.error,
                        style = MaterialTheme.typography.labelLarge)
                }
            } else {
                Row(
                    Modifier
                        .height(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(cs.primary)
                        .clickable { onRerun() }
                        .padding(horizontal = 28.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Filled.PlayArrow, "运行", tint = cs.onPrimary,
                        modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("运行", color = cs.onPrimary,
                        style = MaterialTheme.typography.labelLarge)
                }
            }
        }
        }

        // ---------- pdb 调试快捷条 ----------
        if (debugging && running && onDebugCommand != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                DebugChip("继续", onDebugCommand, "c")
                DebugChip("下一步", onDebugCommand, "n")
                DebugChip("进入", onDebugCommand, "s")
                DebugChip("变量", onDebugCommand, "p locals()")
                DebugChip("栈", onDebugCommand, "w")
                if (onDebugBreak != null) DebugChip("断点", onDebugBreak)
                DebugChip("退出", onDebugCommand, "q")
            }
        }

        // ---------- 头部 ----------
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 14.dp, end = 4.dp, top = 4.dp, bottom = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (running || exitCode != null) {
                    val (dot, label) = when {
                        running -> cs.secondary to "运行中"
                        // 成功用语义 success 色（teal），而非 indigo 强调色，避免和「主操作」混淆
                        exitCode == 0 -> cs.success to "已完成"
                        else -> cs.error to "退出码 $exitCode"
                    }
                    StatusDot(dot)
                    MonoText(
                        "  $label",
                        color = cs.muted,
                        fontSize = 10,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (engineStuck && !running && onRestartEngine != null) {
                TextButton(onClick = onRestartEngine) {
                    Text(
                        "重启引擎",
                        style = MaterialTheme.typography.labelSmall,
                        color = cs.error
                    )
                }
            }
            if (onShare != null && output.isNotEmpty()) {
                QuietIconButton(Icons.Filled.Share, "分享输出", onShare, size = 18.dp)
            }
            if (onCopy != null && output.isNotEmpty()) {
                QuietIconButton(Icons.Filled.ContentCopy, "复制全部", onCopy, size = 18.dp)
            }
            QuietIconButton(Icons.Filled.PlayArrow, "重新运行", onRerun,
                tint = cs.primary, size = 18.dp)
            QuietIconButton(Icons.Filled.Delete, "清空输出", onClear, size = 18.dp)
        }

        // ---------- 输出区 ----------
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        ) {
            if (output.isEmpty()) {
                QuietHint(
                    "点击上方 ▶ 运行，输出会显示在这里",
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                )
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 4.dp)
                ) {
                    itemsIndexed(output, key = { index, _ -> index }) { _, line ->
                        val color = when {
                            line.startsWith("[err]") || line.startsWith("[启动失败]") -> cs.error
                            line.startsWith("——") -> cs.muted
                            line.startsWith("[CodePocket]") || line.startsWith("[执行]") -> cs.muted
                            line.startsWith("💡") -> cs.secondary
                            else -> cs.onSurface.copy(alpha = 0.88f)
                        }
                        // 能解析出行号的报错行才可点，避免所有行都变成点击目标
                        val jumpLine = remember(line) { parseErrorLine(line) }
                        if (jumpLine != null && onJumpToLine != null) {
                            MonoText(
                                line,
                                color = color,
                                fontSize = 11,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(4.dp))
                                    .clickable { onJumpToLine(jumpLine) }
                                    .padding(vertical = 1.dp)
                            )
                        } else {
                            MonoText(line, color = color, fontSize = 11)
                        }
                    }
                }
                // 离开底部时才出现的「↓」回到底部按钮：克制、不常驻，indigo 强调
                if (!atBottom) {
                    IconButton(
                        onClick = {
                            autoFollow = true
                            scope.launch { runCatching { listState.scrollToItem(output.size - 1) } }
                        },
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(end = 8.dp, bottom = 4.dp)
                    ) {
                        Icon(
                            Icons.Filled.KeyboardArrowDown,
                            contentDescription = "回到底部",
                            tint = cs.primary
                        )
                    }
                }
            }
        }

        // ---------- 交互输入入口（默认收起，避免一运行就顶起键盘） ----------
        // 猜数字等依赖 input() 的程序：用户点这里才展开输入行 + 弹键盘。
        if (running && !inputVisible) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onRequestInput?.invoke() }
                    .padding(vertical = 9.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(Icons.Filled.Keyboard, "输入", tint = cs.muted,
                    modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                MonoText("点击输入（交互程序等待输入时）", color = cs.muted, fontSize = 10)
            }
        }

        // ---------- 交互输入行 ----------
        if (inputVisible) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Dimens.gutter, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                QuietTextField(
                    value = inputDraft,
                    onValueChange = onInputChange,
                    modifier = Modifier
                        .weight(1f)
                        .focusRequester(inputFocus),
                    placeholder = if (debugging) "输入 pdb 命令，如 n / b 12 / p x" else "输入后回车发送给程序…",
                    imeAction = ImeAction.Send,
                    onImeAction = onInputSend,
                    trailing = {
                        QuietIconButton(
                            Icons.AutoMirrored.Filled.Send, "发送输入", onInputSend,
                            tint = cs.primary, size = 18.dp
                        )
                    }
                )
            }
            // 方向键/Tab 软键盘：手机上没有物理方向键，补一排
            if (onSpecialKey != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = Dimens.gutter),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    QuietIconButton(Icons.Outlined.KeyboardArrowUp, "上",
                        { onSpecialKey("\u001b[A") }, size = 20.dp)
                    QuietIconButton(Icons.Outlined.KeyboardArrowDown, "下",
                        { onSpecialKey("\u001b[B") }, size = 20.dp)
                    QuietIconButton(Icons.Outlined.KeyboardArrowLeft, "左",
                        { onSpecialKey("\u001b[D") }, size = 20.dp)
                    QuietIconButton(Icons.Outlined.KeyboardArrowRight, "右",
                        { onSpecialKey("\u001b[C") }, size = 20.dp)
                    QuietIconButton(Icons.Outlined.Keyboard, "Tab",
                        { onSpecialKey("\t") }, size = 20.dp)
                }
            }
        }
    }
}

/** pdb 快捷命令按钮：小、可横向滚动，不抢输出区空间。 */
@Composable
private fun DebugChip(
    label: String,
    onCommand: (String) -> Unit,
    command: String,
) {
    val cs = MaterialTheme.colorScheme
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(cs.primary.copy(alpha = 0.08f))
            .clickable { onCommand(command) }
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        MonoText(label, color = cs.primary, fontSize = 11)
    }
}

@Composable
private fun DebugChip(
    label: String,
    onAction: () -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(cs.secondary.copy(alpha = 0.10f))
            .clickable(onClick = onAction)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        MonoText(label, color = cs.secondary, fontSize = 11)
    }
}
