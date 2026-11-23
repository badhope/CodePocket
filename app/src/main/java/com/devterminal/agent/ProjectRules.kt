package com.devterminal.agent

import com.devterminal.workspace.Workspace

/**
 * 项目级 Agent 规则：兼容常见 AI 编程工具的规则文件。
 *
 * 读取顺序不代表权限优先级，只是把项目已有约定带进提示词；
 * 写文件仍然要经过审批。单个文件最多读 80 行，合并后统一截断。
 */
object ProjectRules {
    private const val MAX_CHARS = 1200

    private val candidates = listOf(
        "AGENTS.md",
        "CLAUDE.md",
        ".cursorrules",
        ".windsurfrules",
        ".github/copilot-instructions.md",
        ".codepocket/rules.md",
    )

    fun read(workspace: Workspace): String? {
        val parts = candidates.mapNotNull { path ->
            runCatching {
                val window = workspace.readText(path, 1, 80)
                if (window.content.isBlank()) null else "来源 $path：\n${window.content.trim()}"
            }.getOrNull()
        }.toMutableList()
        ProjectSkills.read(workspace)?.let { parts += it }
        if (parts.isEmpty()) return null
        return parts.joinToString("\n\n").take(MAX_CHARS + 1500)
    }
}
