package com.devterminal.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.devterminal.agent.AgentSessionMeta
import com.devterminal.ui.components.QuietDialog
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.muted
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Agent 历史会话：只回放事件时间线，不会自动重跑任务。 */
@Composable
fun AgentHistoryDialog(
    sessions: List<AgentSessionMeta>,
    loading: Boolean,
    onOpen: (String) -> Unit,
    onDelete: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val format = SimpleDateFormat("MM-dd HH:mm", Locale.getDefault())
    QuietDialog(onDismiss = onDismiss, title = "Agent 历史会话") {
        if (loading) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = Dimens.lg),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(Modifier.width(18.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(Dimens.sm))
                Text("读取中…", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.muted)
            }
            return@QuietDialog
        }
        if (sessions.isEmpty()) {
            QuietHint("还没有 Agent 会话记录。每次 Agent 任务都会自动落盘。")
            return@QuietDialog
        }
        sessions.forEach { session ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .clickable { onOpen(session.id) }
                    .padding(vertical = 7.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        session.task.ifBlank { "（未命名任务）" },
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f),
                        maxLines = 2,
                    )
                    Text(
                        if (session.finished) "已结束" else "未完成",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (session.finished) MaterialTheme.colorScheme.muted else MaterialTheme.colorScheme.primary,
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "${format.format(Date(session.lastAt))} · ${session.eventCount} 条事件",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.muted,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { onDelete(session.id) }) { Text("删除") }
                }
            }
        }
        Spacer(Modifier.width(Dimens.sm))
    }
}
