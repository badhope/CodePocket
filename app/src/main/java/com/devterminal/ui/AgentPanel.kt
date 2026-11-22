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
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.devterminal.agent.AgentEvent
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietDialog
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.components.QuietTextField
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.muted

/**
 * Agent 面板：不是聊天窗口，而是「计划 → 工具 → 观察 → 批准」的可见执行轨迹。
 * 所有状态都来自 AgentEvent，UI 不自己拼执行状态。
 */
@Composable
fun AgentPanelDialog(
    events: List<AgentEvent>,
    busy: Boolean,
    configured: Boolean,
    inputDraft: String,
    pendingProposal: AgentEvent.PatchProposed?,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    onApprove: () -> Unit,
    onReject: () -> Unit,
    onCancel: () -> Unit,
    onDismiss: () -> Unit,
) {
    val listState = rememberLazyListState()
    LaunchedEffect(events.size, pendingProposal, busy) {
        if (events.isNotEmpty()) {
            runCatching { listState.animateScrollToItem(events.size - 1) }
        }
    }

    QuietDialog(
        onDismiss = onDismiss,
        title = "Agent",
        confirmLabel = if (configured && inputDraft.isNotBlank() && !busy) "执行" else null,
        onConfirm = if (configured && inputDraft.isNotBlank() && !busy) onSend else null,
    ) {
        if (!configured) {
            QuietHint(
                "Agent 需要先在设置里配置 OpenAI 兼容端点。配置后它可以读文件、搜索、按行改文件，" +
                    "每次写入前都会停下来让你批准。",
            )
            return@QuietDialog
        }

        Box(Modifier.fillMaxWidth().height(310.dp)) {
            if (events.isEmpty() && !busy) {
                QuietHint(
                    "描述一个任务，例如：把 main.py 的 add 改成支持字符串拼接，并跑一次测试。",
                    modifier = Modifier.align(Alignment.Center),
                )
            }
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxWidth().fillMaxHeight(),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(events) { event ->
                    AgentEventRow(event)
                }
                if (busy) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            MonoText(
                                if (pendingProposal == null) "Agent 工作中…" else "等待批准…",
                                fontSize = 11,
                                color = MaterialTheme.colorScheme.muted,
                                modifier = Modifier.weight(1f),
                            )
                            TextButton(onClick = onCancel) { Text("停止") }
                        }
                    }
                }
            }
        }

        if (pendingProposal != null) {
            Spacer(Modifier.height(Dimens.sm))
            ApprovalCard(
                proposal = pendingProposal,
                onApprove = onApprove,
                onReject = onReject,
            )
        }

        Spacer(Modifier.height(Dimens.sm))
        QuietTextField(
            value = inputDraft,
            onValueChange = onInputChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = if (busy) "Agent 正在执行…" else "让 Agent 改点什么…",
            mono = false,
            enabled = !busy,
            imeAction = androidx.compose.ui.text.input.ImeAction.Send,
            onImeAction = { if (inputDraft.isNotBlank() && !busy) onSend() },
        )
    }
}

@Composable
private fun ApprovalCard(
    proposal: AgentEvent.PatchProposed,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.06f),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(Dimens.sm)) {
            Text(
                "待批准：${proposal.paths.joinToString().ifBlank { "修改文件" }}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(4.dp))
            MonoText(
                proposal.diff,
                fontSize = 11,
                maxLines = 12,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.muted,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = onReject) { Text("拒绝") }
                TextButton(onClick = onApprove) { Text("批准写入") }
            }
        }
    }
}

@Composable
private fun AgentEventRow(event: AgentEvent) {
    when (event) {
        is AgentEvent.SessionStarted -> QuietHint("工作区：${event.projectPath}")
        is AgentEvent.UserMessage -> Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
        ) {
            Surface(
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(0.88f),
            ) {
                Text(
                    event.text,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
                )
            }
        }

        is AgentEvent.Plan -> Column {
            Text("计划", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.muted)
            event.steps.forEachIndexed { index, step ->
                Text("${index + 1}. $step", style = MaterialTheme.typography.bodySmall)
            }
        }

        is AgentEvent.ToolCall -> MonoText(
            "→ ${event.tool}  ${event.arguments.entries.joinToString(" ") { "${it.key}=${it.value.take(60)}" }}",
            fontSize = 11,
            color = MaterialTheme.colorScheme.primary,
        )

        is AgentEvent.ToolResult -> Column {
            Text(
                if (event.ok) "观察" else "工具失败",
                style = MaterialTheme.typography.labelSmall,
                color = if (event.ok) MaterialTheme.colorScheme.muted else MaterialTheme.colorScheme.error,
            )
            MonoText(
                event.output.take(1200),
                fontSize = 11,
                maxLines = 20,
                overflow = TextOverflow.Ellipsis,
                color = if (event.ok) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.72f)
                else MaterialTheme.colorScheme.error,
            )
        }

        is AgentEvent.PatchProposed -> MonoText(
            "待批准写入：${event.paths.joinToString()}",
            fontSize = 11,
            color = MaterialTheme.colorScheme.primary,
        )

        is AgentEvent.Approval -> Text(
            if (event.approved) "已批准" else "已拒绝",
            style = MaterialTheme.typography.labelSmall,
            color = if (event.approved) MaterialTheme.colorScheme.muted else MaterialTheme.colorScheme.error,
        )

        is AgentEvent.PatchApplied -> Text(
            "已写入：${event.paths.joinToString()}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.muted,
        )

        is AgentEvent.Checkpoint -> QuietHint("已创建检查点：${event.label}")

        is AgentEvent.RunResult -> MonoText(
            "exit=${event.exitCode}\n${event.output.take(1000)}",
            fontSize = 11,
            maxLines = 12,
            overflow = TextOverflow.Ellipsis,
            color = if (event.exitCode == 0) MaterialTheme.colorScheme.muted else MaterialTheme.colorScheme.error,
        )

        is AgentEvent.Failure -> Text(
            event.message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
        )

        is AgentEvent.SessionFinished -> Text(
            event.summary,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}
