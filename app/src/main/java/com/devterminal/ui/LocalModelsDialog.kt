package com.devterminal.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.devterminal.model.LocalModelUiState
import com.devterminal.ui.components.QuietDialog
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.components.QuietSwitchRow
import com.devterminal.ui.components.SectionLabel
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.muted

/**
 * 本地模型管理：下载、暂停、删除、设为 Agent 引擎。
 * 权重不进 APK，全部从 ModelScope 下载，SHA-256 校验通过才可选用。
 */
@Composable
fun LocalModelsDialog(
    models: List<LocalModelUiState>,
    activeId: String,
    useLocal: Boolean,
    loading: Boolean,
    onDownload: (String) -> Unit,
    onCancelDownload: () -> Unit,
    onDelete: (String) -> Unit,
    onSelect: (String) -> Unit,
    onToggleUse: (Boolean) -> Unit,
    onDismiss: () -> Unit,
) {
    QuietDialog(onDismiss = onDismiss, title = "本地模型") {
        Text(
            "模型权重不打包进 APK，首次使用从 ModelScope 下载并校验。下载支持续传，文件放在应用外部目录，卸载 App 后会被系统清掉。",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.muted,
        )
        Spacer(Modifier.height(Dimens.sm))
        QuietSwitchRow(
            label = "Agent 使用本地模型",
            hint = "开启后 Agent 不再发网络请求；需要先下载并校验模型",
            checked = useLocal,
            onChange = onToggleUse,
        )
        Spacer(Modifier.height(Dimens.md))
        SectionLabel("可下载")
        Spacer(Modifier.height(Dimens.xs))

        if (loading && models.isEmpty()) {
            QuietHint("正在检查本地模型…")
        }

        models.forEach { item ->
            val spec = item.spec
            Column(Modifier.fillMaxWidth().padding(vertical = Dimens.sm)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(spec.displayName, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "${spec.params} · ${spec.quantization} · ${spec.sizeBytes / 1024 / 1024}MB · 建议 ${spec.minRamGb}GB+",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.muted,
                        )
                    }
                    if (item.installed) {
                        Text(
                            if (activeId == spec.id) "当前使用" else "已安装",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
                Text(spec.note, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.muted)
                Text(
                    "许可证：${spec.licenseName} · 来源 ModelScope",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.muted,
                )

                if (item.downloading) {
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(
                        progress = { item.progress.coerceIn(0f, 1f) },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                    ) {
                        Text(
                            if (item.verifying) "校验中…" else "${(item.progress.coerceAtLeast(0f) * 100).toInt()}%",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.muted,
                        )
                        TextButton(onClick = onCancelDownload) { Text("暂停") }
                    }
                } else {
                    if (!item.error.isNullOrBlank()) {
                        Text(item.error, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                    ) {
                        if (item.installed) {
                            TextButton(onClick = { onDelete(spec.id) }) { Text("删除") }
                            TextButton(onClick = { onSelect(spec.id) }) {
                                Text(if (activeId == spec.id && useLocal) "已选用" else "设为 Agent 模型")
                            }
                        } else {
                            TextButton(onClick = { onDownload(spec.id) }) { Text("下载") }
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(Dimens.sm))
        Text(
            "模型能力与速度取决于手机 CPU / 内存；1B 适合 6GB+，2B 级只建议 8GB+。首次加载会花几秒读模型。",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.muted,
        )
    }
}
