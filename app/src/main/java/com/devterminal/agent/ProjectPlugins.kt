package com.devterminal.agent

import com.devterminal.workspace.Workspace
import java.io.File

/** 项目插件：`.codepocket/plugins` 下的 JS 文件，每个文件必须声明 `run(input)`。 */
data class ProjectPlugin(
    val id: String,
    val title: String,
    val description: String,
    val code: String,
)

object ProjectPlugins {
    private const val MAX_FILES = 8
    private const val MAX_LINES = 250

    fun read(workspace: Workspace): List<ProjectPlugin> {
        val dir = File(workspace.root, ".codepocket/plugins")
        if (!dir.isDirectory) return emptyList()
        return dir.listFiles { file -> file.isFile && file.extension.equals("js", true) }
            ?.sortedBy { it.name }
            ?.take(MAX_FILES)
            ?.mapNotNull { file ->
                runCatching {
                    val path = ".codepocket/plugins/${file.name}"
                    val text = workspace.readText(path, 1, MAX_LINES).content
                    if (text.isBlank()) return@runCatching null
                    val lines = text.lineSequence().toList()
                    val title = lines.firstOrNull { it.startsWith("// name:") }
                        ?.substringAfter("// name:")?.trim()
                        ?.takeIf { it.isNotEmpty() }
                        ?: file.nameWithoutExtension
                    val description = lines.firstOrNull { it.startsWith("// description:") }
                        ?.substringAfter("// description:")?.trim().orEmpty()
                    ProjectPlugin(
                        id = file.nameWithoutExtension.replace(Regex("[^A-Za-z0-9_-]"), "_"),
                        title = title.take(40),
                        description = description.take(120),
                        code = text.take(24_000),
                    )
                }.getOrNull()
            }
            ?: emptyList()
    }
}
