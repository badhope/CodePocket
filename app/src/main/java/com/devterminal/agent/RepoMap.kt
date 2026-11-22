package com.devterminal.agent

import com.devterminal.workspace.Workspace

/**
 * 轻量 RepoMap：不建索引、不常驻内存，每次任务开始时扫一遍项目，
 * 按任务关键词给文件打分，把最相关的文件与符号压成一段短地图塞进系统提示词。
 *
 * 参考 Aider 的 repo map 思路，但这里刻意做得更小：手机端 1B 模型上下文有限，
 * 地图只负责“告诉模型项目里有什么”，具体内容仍由 read_file / search_text 工具读取。
 */
data class RepoFileInfo(
    val path: String,
    val language: String,
    val lines: Int,
    val symbols: List<String>,
    val score: Int,
)

data class RepoMap(
    val text: String,
    val files: List<RepoFileInfo>,
    val totalFiles: Int,
) {
    val isEmpty: Boolean get() = files.isEmpty()
}

class RepoMapBuilder(private val workspace: Workspace) {

    fun build(task: String, maxChars: Int = 2200, maxFiles: Int = 14): RepoMap {
        require(maxChars in 200..12000) { "maxChars must be 200..12000" }
        require(maxFiles in 1..80) { "maxFiles must be 1..80" }

        val all = workspace.listFiles(maxDepth = 10, maxEntries = 2000)
            .filterNot { it.endsWith(".pyc") || it.endsWith(".class") || it.endsWith(".so") }
        val keywords = keywords(task)
        val entries = all.mapNotNull { path -> inspect(path, keywords) }
            .sortedWith(compareByDescending<RepoFileInfo> { it.score }.thenBy { it.path })

        val selected = entries.take(maxFiles)
        val text = render(selected, all.size, maxChars)
        return RepoMap(text, selected, all.size)
    }

    private fun inspect(path: String, keywords: List<String>): RepoFileInfo? {
        val file = runCatching { workspace.resolve(path) }.getOrNull() ?: return null
        if (!file.isFile || file.length() > MAX_FILE_BYTES) return null
        val language = languageOf(path) ?: return null
        val window = runCatching { workspace.readText(path, 1, 500) }.getOrNull() ?: return null
        val symbols = extractSymbols(window.content, language).take(8)
        val score = score(path, symbols, keywords)
        return RepoFileInfo(path, language, window.totalLines, symbols, score)
    }

    private fun score(path: String, symbols: List<String>, keywords: List<String>): Int {
        if (keywords.isEmpty()) return 1
        val lowerPath = path.lowercase()
        val lowerSymbols = symbols.joinToString(" ").lowercase()
        var score = 0
        keywords.forEach { key ->
            if (lowerPath.contains(key)) score += 6
            if (lowerSymbols.contains(key)) score += 10
        }
        // 入口文件和顶层配置略微加权，避免任务描述模糊时地图全是深层实现。
        if (path.count { it == '/' } <= 2) score += 1
        if (path.endsWith("MainActivity.kt") || path.endsWith("main.py") || path.endsWith("index.js")) score += 2
        return score
    }

    private fun render(files: List<RepoFileInfo>, total: Int, maxChars: Int): String {
        if (files.isEmpty()) return "项目地图：未发现可读的源码文件。"
        val header = "项目地图：共 $total 个文件，以下是按任务相关度挑选的 ${files.size} 个。"
        val body = buildString {
            append(header).append('\n')
            files.forEach { info ->
                append("- ").append(info.path)
                append(" [").append(info.language).append(", ").append(info.lines).append(" 行]")
                if (info.symbols.isNotEmpty()) {
                    append(" :: ").append(info.symbols.joinToString(", "))
                }
                append('\n')
            }
            val hidden = total - files.size
            if (hidden > 0) {
                append("其余 $hidden 个文件未展示；需要时用 list_files 或 search_text 查找。")
            }
        }
        if (body.length <= maxChars) return body

        // 超预算时保留表头与前面的文件，末尾补一句提示，避免把提示词顶爆。
        val cut = body.take(maxChars - 40)
        val lastLine = cut.lastIndexOf('\n')
        val safe = if (lastLine > header.length) cut.take(lastLine) else cut
        return safe + "\n（项目地图已截断，更多文件请用 list_files 查看）"
    }

    private fun extractSymbols(content: String, language: String): List<String> {
        val patterns = when (language) {
            "Kotlin", "Java" -> listOf(
                Regex("""\b(?:class|interface|object|enum class|record)\s+([A-Za-z_]\w*)"""),
                Regex("""\bfun\s+([A-Za-z_]\w*)"""),
                Regex("""\b(?:public|private|protected|internal)?\s*(?:static\s+)?[A-Za-z_<>\[\], ?]+\s+([a-z_]\w*)\s*\("""),
            )
            "Python" -> listOf(
                Regex("""^\s*class\s+([A-Za-z_]\w*)""", RegexOption.MULTILINE),
                Regex("""^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)""", RegexOption.MULTILINE),
            )
            "JavaScript", "TypeScript" -> listOf(
                Regex("""\b(?:class|function)\s+([A-Za-z_$][\w$]*)"""),
                Regex("""\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\("""),
                Regex("""\b(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)"""),
            )
            "Lua" -> listOf(
                Regex("""\bfunction\s+([A-Za-z_][\w.:]*)""" ),
                Regex("""\blocal\s+function\s+([A-Za-z_]\w*)""" ),
            )
            else -> listOf(Regex("""\b(?:class|function|def|fn|struct)\s+([A-Za-z_]\w*)"""))
        }
        return patterns.flatMap { regex ->
            regex.findAll(content).mapNotNull { it.groupValues.getOrNull(1) }.toList()
        }.distinct()
    }

    private fun languageOf(path: String): String? = when (path.substringAfterLast('.', "").lowercase()) {
        "kt", "kts" -> "Kotlin"
        "java" -> "Java"
        "py" -> "Python"
        "js", "mjs", "cjs" -> "JavaScript"
        "ts", "tsx" -> "TypeScript"
        "lua" -> "Lua"
        "md" -> "Markdown"
        "json", "yaml", "yml", "toml", "xml" -> "配置"
        else -> null
    }

    private fun keywords(task: String): List<String> {
        val words = Regex("""[A-Za-z_][A-Za-z0-9_]{1,}""")
            .findAll(task.lowercase())
            .map { it.value }
            .filter { it.length >= 2 && it !in STOP_WORDS }
            .toList()
        val cjk = Regex("""[\u4e00-\u9fff]{2,}""").findAll(task).map { it.value }.toList()
        val cjkParts = cjk.flatMap { run ->
            if (run.length <= 4) listOf(run) else run.windowed(2).toList()
        }
        return (words + cjk + cjkParts).distinct().take(24)
    }

    companion object {
        private const val MAX_FILE_BYTES = 256L * 1024
        private val STOP_WORDS = setOf(
            "the", "and", "for", "with", "this", "that", "from", "into", "fix", "add",
            "code", "file", "project", "please", "agent", "task",
        )
    }
}
