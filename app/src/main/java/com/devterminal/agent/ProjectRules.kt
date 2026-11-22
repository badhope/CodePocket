package com.devterminal.agent

import com.devterminal.workspace.Workspace

/**
 * 项目级 Agent 规则：优先 AGENTS.md，其次 .codepocket/rules.md。
 * 规则只作为提示词，不是权限系统；写文件仍然要经过审批。
 */
object ProjectRules {
    private const val MAX_CHARS = 1200

    fun read(workspace: Workspace): String? {
        val candidates = listOf("AGENTS.md", ".codepocket/rules.md")
        val parts = candidates.mapNotNull { path ->
            runCatching {
                val window = workspace.readText(path, 1, 80)
                if (window.content.isBlank()) null else "来源 $path：\n${window.content.trim()}"
            }.getOrNull()
        }
        if (parts.isEmpty()) return null
        return parts.joinToString("\n\n").take(MAX_CHARS)
    }
}
