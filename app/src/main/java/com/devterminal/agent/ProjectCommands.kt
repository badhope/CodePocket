package com.devterminal.agent

import com.devterminal.workspace.Workspace
import java.io.File

/** 项目自定义命令：`.codepocket/commands` 下的 Markdown 文件，命令名取首行标题。 */
data class ProjectCommand(
    val id: String,
    val title: String,
    val description: String,
    val body: String,
)

object ProjectCommands {
    private const val MAX_FILES = 20

    fun read(workspace: Workspace): List<ProjectCommand> {
        val dir = File(workspace.root, ".codepocket/commands")
        if (!dir.isDirectory) return emptyList()
        return dir.listFiles { file -> file.isFile && file.extension.equals("md", true) }
            ?.sortedBy { it.name }
            ?.take(MAX_FILES)
            ?.mapNotNull { file ->
                runCatching {
                    val path = ".codepocket/commands/${file.name}"
                    val text = workspace.readText(path, 1, 120).content.trim()
                    if (text.isBlank()) return@runCatching null
                    val lines = text.lineSequence().toList()
                    val heading = lines.firstOrNull { it.startsWith("# ") }?.removePrefix("# ")?.trim()
                    val title = heading?.takeIf { it.isNotEmpty() }
                        ?: file.nameWithoutExtension.replace('-', ' ')
                    val description = lines.firstOrNull {
                        it.isNotBlank() && !it.startsWith("#") && !it.startsWith("//")
                    }?.trim().orEmpty()
                    ProjectCommand(
                        id = file.nameWithoutExtension.replace(Regex("[^A-Za-z0-9_-]"), "_"),
                        title = title.take(40),
                        description = description.take(100),
                        body = text.take(1200),
                    )
                }.getOrNull()
            }
            ?: emptyList()
    }
}
