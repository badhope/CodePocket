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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
    pendingPlan: AgentEvent.Plan?,
    planFirst: Boolean,
    lastCheckpoint: AgentEvent.Checkpoint?,
    checkpointCount: Int,
    recovered: Boolean,
    onInputChange: (String) -> Unit,
    onSend: () -> Unit,
    onApprove: () -> Unit,
    onReject: () -> Unit,
    onRestoreCheckpoint: () -> Unit,
    onOpenHistory: () -> Unit,
    onNewSession: () -> Unit,
    onPlanToggle: (Boolean) -> Unit,
    onApprovePlan: () -> Unit,
    onRejectPlan: () -> Unit,
    onCancel: () -> Unit,
    onDismiss: () -> Unit,
) {
    val listState = rememberLazyListState()
    var confirmRestore by remember { mutableStateOf(false) }
    LaunchedEffect(events.size, pendingProposal, pendingPlan, busy) {
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

        if (recovered) {
            QuietHint("这是上次保存的 Agent 会话记录；点「新会话」可从空上下文重开。")
            Spacer(Modifier.height(Dimens.sm))
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
                                when {
                                    pendingPlan != null -> "等待批准计划…"
                                    pendingProposal == null -> "Agent 工作中…"
                                    else -> "等待批准…"
                                },
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

        if (pendingPlan != null) {
            Spacer(Modifier.height(Dimens.sm))
            PlanCard(plan = pendingPlan, onApprove = onApprovePlan, onReject = onRejectPlan)
        }

        if (pendingProposal != null) {
            Spacer(Modifier.height(Dimens.sm))
            ApprovalCard(
                proposal = pendingProposal,
                onApprove = onApprove,
                onReject = onReject,
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
        ) {
            TextButton(onClick = onNewSession, enabled = !busy) {
                Text(
                    "新会话",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.muted,
                )
            }
            TextButton(onClick = { onPlanToggle(!planFirst) }, enabled = !busy) {
                Text(
                    if (planFirst) "先计划：开" else "先计划：关",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (planFirst) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.muted,
                )
            }
            TextButton(onClick = onOpenHistory, enabled = !busy) {
                Text(
                    "历史会话",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.muted,
                )
            }
        }

        if (checkpointCount > 0 && !busy) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = { confirmRestore = true }) {
                    Text(
                        "撤销本次 Agent 修改（$checkpointCount 个检查点）",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.muted,
                    )
                }
            }
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

    if (confirmRestore) {
        AlertDialog(
            onDismissRequest = { confirmRestore = false },
            title = { Text("恢复到 Agent 修改前") },
            text = {
                Text(
                    "将把本次修改过的文件（${lastCheckpoint?.label ?: "检查点"}）恢复为快照内容。" +
                        "当前未保存的编辑会丢失，确定继续？",
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirmRestore = false
                    onRestoreCheckpoint()
                }) { Text("恢复") }
            },
            dismissButton = {
                TextButton(onClick = { confirmRestore = false }) { Text("取消") }
            },
        )
    }
}

@Composable
private fun PlanCard(
    plan: AgentEvent.Plan,
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
                "待批准的计划",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(4.dp))
            plan.steps.forEachIndexed { index, step ->
                Text("${index + 1}. $step", style = MaterialTheme.typography.bodySmall)
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
            ) {
                TextButton(onClick = onReject) { Text("重写计划") }
                TextButton(onClick = onApprove) { Text("批准执行") }
            }
        }
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
                "待批准：${proposal.paths.joinToString().ifBlank { "执行工具" }}",
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
                TextButton(onClick = onApprove) { Text("批准执行") }
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

        is AgentEvent.ContextBuilt -> QuietHint(
            "项目地图：挑选 ${event.mappedFiles}/${event.totalFiles} 个文件（${event.chars} 字符 · 约 ${event.tokens} tokens）",
        )
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
