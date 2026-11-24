package com.devterminal.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.devterminal.ui.components.EdgeToEdgeDialog
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.components.SectionLabel
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.hairline
import com.devterminal.ui.theme.muted

/** 一条可执行命令（动作 + 元信息） */
data class Command(
    val id: String,
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val action: () -> Unit
)

/**
 * 命令面板（⌘K）：Cursor / VS Code 的动作搜索范式。
 *
 * 所有功能在这里都能一键到达——移动端放不下 N 层菜单，
 * 「搜索一切」是最省屏幕空间的交互。
 *
 * 视觉重构：搜索框去掉描边（无边框 + 底部一条发丝线），因为面板本身就是浮层，
 * 再套一层描边输入框会显得很啰嗦；列表项图标降为中性色，只在文字上做层级。
 */
@Composable
fun CommandPalette(
    commands: List<Command>,
    onDismiss: () -> Unit,
    /** 「最近打开」的最近项目项；空则不显示该分组。query 非空时自动隐藏。 */
    recent: List<Command> = emptyList()
) {
    var query by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    val cs = MaterialTheme.colorScheme

    val filtered = remember(query, commands) {
        if (query.isBlank()) commands
        else commands.filter {
            it.title.contains(query, ignoreCase = true) ||
                it.subtitle.contains(query, ignoreCase = true)
        }
    }

    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    EdgeToEdgeDialog(onDismiss = onDismiss, contentAlignment = Alignment.TopCenter) {
        Surface(
            modifier = Modifier
                .widthIn(max = 560.dp)
                .fillMaxWidth()
                .heightIn(max = maxHeight),
            shape = RoundedCornerShape(24.dp),
            color = cs.surface,
            shadowElevation = 8.dp,
        ) {
            Column(Modifier.fillMaxWidth().padding(top = Dimens.lg, bottom = Dimens.sm)) {
                TextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Dimens.lg)
                        .focusRequester(focus),
                    placeholder = {
                        Text("搜索命令…", style = MaterialTheme.typography.bodyLarge,
                            color = cs.faint)
                    },
                    singleLine = true,
                    textStyle = MaterialTheme.typography.bodyLarge,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = {
                        // 回车直接执行第一条，符合命令面板的肌肉记忆
                        filtered.firstOrNull()?.let { onDismiss(); it.action() }
                    }),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = Color.Transparent,
                        unfocusedContainerColor = Color.Transparent,
                        disabledContainerColor = Color.Transparent,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        cursorColor = cs.primary
                    )
                )
                Spacer(Modifier.height(Dimens.sm))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(cs.hairline)
                )
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false)
                        .heightIn(max = 380.dp)
                ) {
                    // 最近打开：仅在未输入查询时展示，命中搜索时只显示过滤后的命令
                    if (query.isBlank() && recent.isNotEmpty()) {
                        item(key = "hdr_recent") {
                            SectionLabel("最近打开",
                                modifier = Modifier.padding(start = Dimens.lg, top = Dimens.sm, bottom = Dimens.xs))
                        }
                        items(recent, key = { "recent_" + it.id }) { cmd ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(10.dp))
                                    .clickable { onDismiss(); cmd.action() }
                                    .padding(horizontal = Dimens.lg, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(cmd.icon, null, modifier = Modifier.size(18.dp), tint = cs.primary)
                                Spacer(Modifier.width(Dimens.md))
                                Column(Modifier.weight(1f)) {
                                    Text(cmd.title, style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium)
                                    if (cmd.subtitle.isNotBlank()) {
                                        Text(cmd.subtitle, style = MaterialTheme.typography.labelSmall,
                                            color = cs.muted)
                                    }
                                }
                            }
                        }
                        item(key = "hdr_all") {
                            SectionLabel("全部命令",
                                modifier = Modifier.padding(start = Dimens.lg, top = Dimens.md, bottom = Dimens.xs))
                        }
                    }
                    items(filtered, key = { it.id }) { cmd ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .clickable { onDismiss(); cmd.action() }
                                .padding(horizontal = Dimens.lg, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                cmd.icon, null,
                                modifier = Modifier.size(18.dp),
                                tint = cs.muted
                            )
                            Spacer(Modifier.width(Dimens.md))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    cmd.title,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Medium
                                )
                                if (cmd.subtitle.isNotBlank()) {
                                    Text(
                                        cmd.subtitle,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = cs.muted
                                    )
                                }
                            }
                        }
                    }
                    if (filtered.isEmpty() && query.isNotBlank()) {
                        item {
                            Box(
                                Modifier.fillMaxWidth().padding(vertical = Dimens.xxl),
                                contentAlignment = Alignment.Center
                            ) {
                                QuietHint("没有匹配「$query」的命令")
                            }
                        }
                    }
                }
            }
        }
    }
}
