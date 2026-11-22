package com.devterminal.agent

import com.devterminal.workspace.Workspace
import java.io.File

/**
 * 项目级技能目录：`.codepocket/skills` 下的 Markdown 文件。
 *
 * 不执行任意脚本，只把短小的操作约定注入提示词；最多 3 个文件，
 * 防止一个目录把上下文预算吃光。真正的权限仍然由审批和路径监狱兜底。
 */
object ProjectSkills {
    private const val MAX_FILES = 3
    private const val MAX_CHARS = 1500
    private const val MAX_LINES = 40

    fun read(workspace: Workspace): String? {
        val dir = File(workspace.root, ".codepocket/skills")
        if (!dir.isDirectory) return null
        val files = dir.listFiles { file -> file.isFile && file.extension.equals("md", true) }
            ?.sortedBy { it.name }
            ?.take(MAX_FILES)
            ?: return null
        val parts = files.mapNotNull { file ->
            runCatching {
                val path = ".codepocket/skills/${file.name}"
                val window = workspace.readText(path, 1, MAX_LINES)
                if (window.content.isBlank()) null
                else "技能 $path：\n${window.content.trim()}"
            }.getOrNull()
        }
        if (parts.isEmpty()) return null
        return parts.joinToString("\n\n").take(MAX_CHARS)
    }
}
