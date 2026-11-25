package com.devterminal.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Undo
import androidx.compose.material.icons.outlined.CloudDownload
import androidx.compose.material.icons.outlined.CloudUpload
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.devterminal.engine.GitManager
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietAction
import com.devterminal.ui.components.QuietDialog
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.components.QuietTextField
import com.devterminal.ui.components.SectionLabel
import com.devterminal.ui.components.StatusDot
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.muted

/**
 * Git 面板：仓库状态 / 提交 / 推送 / 拉取，对标 Spck 的 Git 工作流。
 *
 * 状态刷新、init、commit、push、pull 全部走 JGit（纯 Java 实现，随 APK 打包，
 * 无外部二进制依赖，依旧离线）；远程凭据走 URL 内嵌 token（用户在配置区填写）。
 *
 * 视觉重构：变更列表不再一行行堆 primary 色文本，改为等宽灰阶 + 状态色点；
 * 主按钮收敛为一个「提交」，推送/拉取降级为无背景的文字动作。
 */
@Composable
fun GitPanelDialog(
    status: GitManager.GitStatus?,
    busy: Boolean,
    lastResult: String?,
    gitInstalled: Boolean,
    gitName: String,
    gitEmail: String,
    remoteUrl: String,
    onConfigChange: (name: String, email: String, remote: String) -> Unit,
    onRefresh: () -> Unit,
    onInit: () -> Unit,
    onCommit: (String) -> Unit,
    onPush: () -> Unit,
    onPull: () -> Unit,
    onStage: (String) -> Unit = {},
    onUnstage: (String) -> Unit = {},
    onStageAll: () -> Unit = {},
    onDiff: (String) -> Unit = {},
    onDismiss: () -> Unit
) {
    var commitMsg by remember { mutableStateOf("") }
    var showConfig by remember { mutableStateOf(gitName.isBlank() && remoteUrl.isBlank()) }
    var cfgName by remember { mutableStateOf(gitName) }
    var cfgEmail by remember { mutableStateOf(gitEmail) }
    var cfgRemote by remember { mutableStateOf(remoteUrl) }
    val cs = MaterialTheme.colorScheme

    QuietDialog(
        onDismiss = onDismiss,
        title = "Git 仓库",
        confirmLabel = "刷新",
        onConfirm = onRefresh
    ) {
        if (!gitInstalled) {
            Row(verticalAlignment = Alignment.Top) {
                StatusDot(cs.error)
                Spacer(Modifier.size(Dimens.sm))
                Text(
                    "Git 由 JGit 纯 Java 实现，离线可用。当前目录未初始化为 Git 仓库。",
                    style = MaterialTheme.typography.bodySmall,
                    color = cs.error,
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(Modifier.height(Dimens.md))
        }

        when {
            busy -> {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(15.dp), strokeWidth = 1.6.dp)
                    Spacer(Modifier.size(Dimens.sm))
                    Text(
                        "Git 执行中…",
                        style = MaterialTheme.typography.bodyMedium,
                        color = cs.muted
                    )
                }
            }
            status == null || !status.isRepo -> {
                QuietHint("当前项目还不是 Git 仓库")
                Spacer(Modifier.height(Dimens.md))
                TextButton(onClick = onInit) {
                    Text(
                        "初始化仓库（main）",
                        style = MaterialTheme.typography.labelLarge,
                        color = cs.primary
                    )
                }
            }
            else -> {
                // 分支 + 变更数
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MonoText(
                        status.branch,
                        fontSize = 13,
                        color = cs.onSurface
                    )
                    Spacer(Modifier.weight(1f))
                    Text(
                        "${status.changes.size} 个变更",
                        style = MaterialTheme.typography.labelSmall,
                        color = cs.muted
                    )
                }
                Spacer(Modifier.height(Dimens.sm))
                // 变更列表
                Column(
                    Modifier
                        .fillMaxWidth()
                        .height(if (status.changes.size > 4) 116.dp else 44.dp)
                ) {
                    if (status.changes.isEmpty()) {
                        QuietHint("工作区干净")
                    } else {
                        // weight(1f)：变更列表填满固定高度的容器，超出可滚动而不是被裁
                        LazyColumn(Modifier.fillMaxWidth().weight(1f)) {
                            items(status.changes, key = { it.path }) { c ->
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .clickable { onDiff(c.path) }
                                        .padding(vertical = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    StatusDot(if (c.statusCode.trim() == "??") cs.tertiary else cs.primary)
                                    Spacer(Modifier.size(Dimens.sm))
                                    MonoText(
                                        c.path,
                                        fontSize = 11,
                                        maxLines = 1,
                                        color = cs.onSurface.copy(alpha = 0.8f),
                                        modifier = Modifier.weight(1f)
                                    )
                                    MonoText(
                                        c.statusCode.trim(),
                                        fontSize = 11,
                                        color = cs.faint
                                    )
                                    TextButton(
                                        onClick = { if (c.isStaged) onUnstage(c.path) else onStage(c.path) },
                                        contentPadding = androidx.compose.foundation.layout.PaddingValues(
                                            horizontal = 6.dp, vertical = 0.dp
                                        )
                                    ) {
                                        Text(
                                            if (c.isStaged) "取消" else "暂存",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = cs.muted
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(Dimens.md))
                QuietTextField(
                    value = commitMsg,
                    onValueChange = { commitMsg = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = "提交信息…",
                    imeAction = ImeAction.Done,
                    onImeAction = { if (commitMsg.isNotBlank()) onCommit(commitMsg); commitMsg = "" }
                )
                Spacer(Modifier.height(Dimens.xs))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Dimens.xs)
                ) {
                    TextButton(
                        onClick = onStageAll,
                        enabled = status.changes.any { !it.isStaged }
                    ) {
                        Text(
                            "全部暂存",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (status.changes.any { !it.isStaged }) cs.muted else cs.faint
                        )
                    }
                    TextButton(
                        onClick = { onCommit(commitMsg); commitMsg = "" },
                        enabled = commitMsg.isNotBlank() && status.changes.any { it.isStaged }
                    ) {
                        Icon(
                            Icons.AutoMirrored.Outlined.Undo, null,
                            Modifier.size(15.dp),
                            tint = if (commitMsg.isNotBlank() && status.changes.any { it.isStaged }) cs.primary else cs.faint
                        )
                        Spacer(Modifier.size(6.dp))
                        Text(
                            "提交暂存",
                            style = MaterialTheme.typography.labelLarge,
                            color = if (commitMsg.isNotBlank() && status.changes.any { it.isStaged }) cs.primary else cs.faint
                        )
                    }
                    Spacer(Modifier.weight(1f))
                    QuietAction(
                        icon = Icons.Outlined.CloudUpload,
                        label = "推送",
                        onClick = onPush,
                        tint = cs.muted
                    )
                    QuietAction(
                        icon = Icons.Outlined.CloudDownload,
                        label = "拉取",
                        onClick = onPull,
                        tint = cs.muted
                    )
                }
                if (status.recentCommits.isNotEmpty()) {
                    Spacer(Modifier.height(Dimens.md))
                    SectionLabel("最近提交", modifier = Modifier.padding(bottom = Dimens.xs))
                    status.recentCommits.take(3).forEach { c ->
                        MonoText(c, fontSize = 11, color = cs.muted)
                    }
                }
            }
        }

        lastResult?.let {
            Spacer(Modifier.height(Dimens.md))
            MonoText(it, fontSize = 11, color = cs.secondary)
        }

        // ---------- 配置区 ----------
        Spacer(Modifier.height(Dimens.sm))
        TextButton(onClick = { showConfig = !showConfig }) {
            Text(
                if (showConfig) "收起配置" else "配置身份 / 远程",
                style = MaterialTheme.typography.labelSmall,
                color = cs.muted
            )
        }
        if (showConfig) {
            QuietTextField(
                value = cfgName,
                onValueChange = { cfgName = it },
                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                placeholder = "Git 用户名"
            )
            QuietTextField(
                value = cfgEmail,
                onValueChange = { cfgEmail = it },
                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                placeholder = "Git 邮箱"
            )
            QuietTextField(
                value = cfgRemote,
                onValueChange = { cfgRemote = it },
                modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                placeholder = "远程 URL（token 可内嵌）"
            )
            TextButton(
                onClick = {
                    onConfigChange(cfgName.trim(), cfgEmail.trim(), cfgRemote.trim())
                    showConfig = false
                }
            ) {
                Text(
                    "保存配置",
                    style = MaterialTheme.typography.labelLarge,
                    color = cs.primary
                )
            }
        }
    }
}

/**
 * 只读 Diff 审阅。QuietDialog 的正文本身可滚动，这里不再嵌套 scroll，
 * 避免同方向滚动容器抢手势。差异文本超过 200KB 时 GitManager 已截断。
 */
@Composable
fun GitDiffDialog(
    path: String,
    diff: String,
    loading: Boolean,
    onDismiss: () -> Unit
) {
    val cs = MaterialTheme.colorScheme
    QuietDialog(onDismiss = onDismiss, title = "差异 · $path") {
        if (loading) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 1.6.dp)
                Spacer(Modifier.size(Dimens.sm))
                Text("读取差异…", style = MaterialTheme.typography.bodySmall, color = cs.muted)
            }
        } else {
            androidx.compose.foundation.text.selection.SelectionContainer {
                MonoText(
                    diff.ifBlank { "没有可显示的差异" },
                    fontSize = 11,
                    color = cs.onSurface.copy(alpha = 0.85f)
                )
            }
        }
    }
}
