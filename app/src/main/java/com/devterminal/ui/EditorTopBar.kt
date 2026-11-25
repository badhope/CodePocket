package com.devterminal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.outlined.BugReport
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Preview
import androidx.compose.material.icons.outlined.Terminal
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietIconButton
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.muted

/**
 * 主界面顶栏。
 *
 * 普通手机上它是「菜单 + 文件名 + 运行」的窄条；宽屏上才展开预览、命令面板、调试。
 * 小屏或大字号时把次要动作收进「更多」，避免 44dp 触控目标在 360dp 宽的手机上
 * 把标题挤成一条省略号。纯展示 + 回调，方便在 Robolectric 里单独验证两种形态。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun EditorTopBar(
    fileName: String?,
    dirty: Boolean,
    languageLabel: String,
    isRunnable: Boolean,
    canRun: Boolean,
    isPython: Boolean,
    previewable: Boolean,
    previewVisible: Boolean,
    running: Boolean,
    compact: Boolean,
    onOpenDrawer: () -> Unit,
    onSave: () -> Unit,
    onStop: () -> Unit,
    onRun: () -> Unit,
    onDebug: () -> Unit,
    onPalette: () -> Unit,
    onPreview: () -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    var moreExpanded by remember { mutableStateOf(false) }

    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                MonoText(
                    fileName ?: "未打开文件",
                    color = if (fileName != null) cs.onSurface else cs.faint,
                    fontSize = 13,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                if (dirty) {
                    Spacer(Modifier.width(6.dp))
                    Box(
                        Modifier
                            .size(6.dp)
                            .background(cs.secondary, CircleShape)
                    )
                }
                // 小屏只留文件名：语言名和「仅编辑」在 320dp 宽、200% 字体下最先被挤掉。
                if (!compact && fileName != null) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        languageLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = cs.muted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!isRunnable) {
                        Spacer(Modifier.width(4.dp))
                        Text(
                            "仅编辑",
                            style = MaterialTheme.typography.labelSmall,
                            color = cs.faint,
                            maxLines = 1
                        )
                    }
                }
            }
        },
        navigationIcon = {
            IconButton(onClick = onOpenDrawer) {
                Icon(Icons.Outlined.Menu, "打开文件树", tint = cs.muted)
            }
        },
        actions = {
            if (!compact && previewable) {
                QuietIconButton(
                    Icons.Outlined.Preview, "实时预览",
                    onClick = onPreview,
                    tint = if (previewVisible) cs.primary else cs.muted
                )
            }
            if (!compact) {
                QuietIconButton(
                    Icons.Outlined.Terminal, "命令面板",
                    onClick = onPalette
                )
            }
            if (dirty) {
                QuietIconButton(
                    Icons.Filled.Save, "保存",
                    onClick = onSave, tint = cs.primary
                )
            }
            if (!compact && canRun && isPython) {
                QuietIconButton(
                    Icons.Outlined.BugReport, "调试当前文件",
                    onClick = onDebug,
                    tint = cs.muted,
                    size = 20.dp
                )
            }
            if (running) {
                QuietIconButton(
                    Icons.Filled.Stop, "停止",
                    onClick = onStop, tint = cs.error
                )
            } else {
                QuietIconButton(
                    Icons.Filled.PlayArrow, "运行",
                    onClick = onRun,
                    enabled = canRun,
                    tint = if (canRun) cs.primary else cs.faint,
                    size = 24.dp
                )
            }
            if (compact) {
                Box {
                    QuietIconButton(
                        Icons.Filled.MoreVert, "更多操作",
                        onClick = { moreExpanded = true },
                        tint = cs.muted
                    )
                    DropdownMenu(
                        expanded = moreExpanded,
                        onDismissRequest = { moreExpanded = false }
                    ) {
                        if (previewable) {
                            DropdownMenuItem(
                                text = { Text(if (previewVisible) "关闭实时预览" else "实时预览") },
                                onClick = {
                                    moreExpanded = false
                                    onPreview()
                                }
                            )
                        }
                        DropdownMenuItem(
                            text = { Text("命令面板") },
                            onClick = {
                                moreExpanded = false
                                onPalette()
                            }
                        )
                        if (canRun && isPython) {
                            DropdownMenuItem(
                                text = { Text("调试当前文件") },
                                onClick = {
                                    moreExpanded = false
                                    onDebug()
                                }
                            )
                        }
                    }
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = cs.surface,
            scrolledContainerColor = cs.surface
        )
    )
}
