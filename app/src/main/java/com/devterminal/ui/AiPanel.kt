package com.devterminal.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.devterminal.engine.AiClient
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietDialog
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.components.QuietTextField
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.muted

/**
 * AI 助手面板：BYOK（自带密钥），端点在设置页自行配置。
 *
 * 四个快捷动作：解释此文件 / 修复运行错误 / 生成测试 / 添加注释。
 * 未配置端点时显示引导而不是空白。
 *
 * 视觉重构：气泡从「实心色块」改为 4% / 8% 的极淡底色 + 14dp 圆角，
 * 靠左右对齐和字号区分角色，不再靠颜色；快捷动作改为描边细条。
 */
private val QUICK_ACTIONS = listOf(
    "解释此文件", "修复运行错误", "生成测试", "加注释"
)

@Composable
fun AiPanelDialog(
    messages: List<AiClient.ChatMessage>,
    busy: Boolean,
    configured: Boolean,
    inputDraft: String,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    onQuick: (String) -> Unit,
    onCancel: () -> Unit,
    onInsertCode: (String) -> Unit,
    onOpenAgent: () -> Unit,
    onNewChat: () -> Unit,
    onDismiss: () -> Unit
) {
    val listState = rememberLazyListState()
    // 新消息到达时滚到底部
    LaunchedEffect(messages.size, busy) {
        if (messages.isNotEmpty()) {
            runCatching { listState.animateScrollToItem(messages.size - 1) }
        }
    }

    QuietDialog(
        onDismiss = onDismiss,
        title = "AI 助手",
        confirmLabel = "发送",
        onConfirm = if (configured && inputDraft.isNotBlank() && !busy) onSend else null,
        // 输入框固定在底部，不跟正文一起滚动；键盘弹出时始终可见。
        footer = {
            QuietTextField(
                value = inputDraft,
                onValueChange = onInputChange,
                modifier = Modifier.fillMaxWidth(),
                placeholder = if (configured) "问点什么…" else "先在上方完成 AI 配置",
                mono = false,
                enabled = configured && !busy,
                imeAction = ImeAction.Send,
                onImeAction = { if (inputDraft.isNotBlank() && !busy) onSend() }
            )
        },
    ) {
        if (!configured) {
            QuietHint(
                "未配置端点。请在设置里填入 OpenAI 兼容端点与密钥（BYOK）。" +
                    "AI 是可选的在线服务，不配置也不影响其他功能。"
            )
        } else {
            Box(Modifier.fillMaxWidth().height(260.dp)) {
                if (messages.isEmpty() && !busy) {
                    QuietHint(
                        "问我任何关于当前文件的问题，或用下面的快捷动作",
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
                // 消息列表填满固定高度 Box：原先只 fillMaxWidth，超长对话会被 Box 直接裁掉
                LazyColumn(state = listState, modifier = Modifier.fillMaxWidth().fillMaxHeight()) {
                    items(messages) { m ->
                        Bubble(m, onInsertCode)
                        Spacer(Modifier.height(Dimens.sm))
                    }
                    if (busy) {
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                MonoText(
                                    "AI 思考中…",
                                    fontSize = 11,
                                    color = MaterialTheme.colorScheme.muted,
                                    modifier = Modifier.weight(1f).padding(vertical = Dimens.xs)
                                )
                                TextButton(onClick = onCancel) { Text("取消") }
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(Dimens.sm))
            // 快捷动作：横向滚动，不强行四等分。
            // 320-360dp 手机四等分后每个按钮约 70dp，中文标签会被挤到换行或裁切。
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(Dimens.xs)
            ) {
                QUICK_ACTIONS.forEach { label ->
                    TextButton(
                        onClick = { onQuick(label) },
                        enabled = !busy
                    ) {
                        Text(
                            label,
                            style = MaterialTheme.typography.labelSmall,
                            maxLines = 1,
                            color = if (busy) MaterialTheme.colorScheme.faint
                            else MaterialTheme.colorScheme.muted
                        )
                    }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = onNewChat, enabled = !busy && messages.isNotEmpty()) {
                    Text(
                        "新对话",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.muted
                    )
                }
                TextButton(onClick = onOpenAgent, enabled = !busy) {
                    Text(
                        "Agent 模式：让 AI 读项目、改文件",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
        }
    }
}

@Composable
private fun Bubble(m: AiClient.ChatMessage, onInsertCode: (String) -> Unit) {
    val isUser = m.role == "user"
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Surface(
            color = if (isUser) MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)
            else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
            shape = RoundedCornerShape(
                topStart = 14.dp, topEnd = 14.dp,
                bottomStart = if (isUser) 14.dp else 4.dp,
                bottomEnd = if (isUser) 4.dp else 14.dp
            ),
            modifier = Modifier.widthIn(max = 290.dp)
        ) {
            if (isUser) {
                Text(
                    m.content,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp)
                )
            } else {
                // P2-3：把 assistant 回答按 ``` 拆成散文段 / 代码段；代码段带「插入」按钮。
                // 流式时最后一段可能还没收尾，奇数位同样按代码块渲染。
                Column(Modifier.padding(vertical = 4.dp)) {
                    m.content.split("```").forEachIndexed { i, raw ->
                        if (i % 2 == 1) {
                            // 去掉首行语言标注（如 ```python）
                            val code = raw.trimStart().substringAfter("\n", "").trimEnd()
                            if (code.isNotBlank()) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Spacer(Modifier.weight(1f))
                                    TextButton(onClick = { onInsertCode(code) }) {
                                        Text("插入", style = MaterialTheme.typography.labelSmall)
                                    }
                                }
                                MonoText(
                                    code,
                                    fontSize = 12,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                                )
                            }
                        } else if (raw.isNotBlank()) {
                            Text(
                                raw.trim(),
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
