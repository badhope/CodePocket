package com.devterminal.language

import com.devterminal.workspace.Workspace

/**
 * 项目级 Python 符号索引。
 *
 * 它不是 LSP：不启动进程、不做类型推断、不下载语言服务器。
 * 目标只有两个，且都必须在手机上足够快：
 *  1. 光标停在某个名字上时，找到它在项目里的定义；
 *  2. 同名符号有多处时，列出文件、行号和签名让用户自己选。
 *
 * 索引范围刻意收紧：只扫 .py、只读前 512KB、最多 300 个文件。
 * 手机 IDE 里“全项目语义”不是刚需，卡顿才是。
 */
class ProjectSymbolIndex(private val workspace: Workspace) {

    data class Definition(
        val path: String,
        val name: String,
        val kind: String,
        val line: Int,
        val signature: String,
    )

    /**
     * 查找定义。排序规则：
     * 当前文件优先 → import 指向的模块优先 → 路径更短/行号更靠前。
     */
    fun find(
        name: String,
        fromPath: String,
        limit: Int = 60,
    ): List<Definition> {
        val query = name.trim()
        if (query.isEmpty() || !query.matches(IDENTIFIER)) return emptyList()

        val fromText = runCatching { workspace.readText(fromPath, 1, 500).content }.getOrNull()
        val importHints = fromText?.let(::importHints).orEmpty()

        val candidates = workspace.listFiles(maxDepth = 8, maxEntries = 600)
            .asSequence()
            .filter { it.endsWith(".py", ignoreCase = true) }
            .take(MAX_FILES)
            .mapNotNull { path ->
                val file = runCatching { workspace.resolve(path) }.getOrNull() ?: return@mapNotNull null
                if (!file.isFile || file.length() > MAX_BYTES) return@mapNotNull null
                val text = runCatching { file.readText() }.getOrNull() ?: return@mapNotNull null
                parse(path, text)
            }
            .flatten()
            .filter { it.name == query }
            .sortedWith(
                compareBy(
                    { if (it.path == fromPath) 0 else 1 },
                    { if (matchesImport(it.path, importHints)) 0 else 1 },
                    { it.path.length },
                    { it.line },
                )
            )
            .take(limit)
            .toList()

        return candidates
    }

    /** 当前行、当前列（均为 1 基）下的标识符；不在标识符上则返回 null。 */
    fun wordAt(text: String, line: Int, column: Int): String? {
        val lines = text.split('\n')
        val lineText = lines.getOrNull((line - 1).coerceAtLeast(0)) ?: return null
        if (lineText.isEmpty()) return null

        val cursor = (column - 1).coerceIn(0, lineText.length)
        val onIdentifier = cursor < lineText.length && isIdentifierPart(lineText[cursor])
        val atLineEnd = cursor == lineText.length &&
            cursor > 0 && isIdentifierPart(lineText[cursor - 1])
        if (!onIdentifier && !atLineEnd) return null
        var start = cursor
        while (start > 0 && isIdentifierPart(lineText[start - 1])) start--
        var end = cursor
        while (end < lineText.length && isIdentifierPart(lineText[end])) end++
        if (start == end) return null
        return lineText.substring(start, end)
    }

    /** 解析一个 Python 文件里的类、函数和模块级变量。 */
    fun parse(path: String, text: String): List<Definition> {
        val result = ArrayList<Definition>(24)
        text.lineSequence().forEachIndexed { index, raw ->
            val line = raw.trimEnd()
            val trimmed = line.trimStart()
            if (trimmed.isEmpty() || trimmed.startsWith("#")) return@forEachIndexed

            PY_CLASS.find(line)?.let { match ->
                result += Definition(path, match.groupValues[1], "类", index + 1, trimmed.take(MAX_SIGNATURE))
                return@forEachIndexed
            }
            PY_DEF.find(line)?.let { match ->
                result += Definition(path, match.groupValues[1], "函数", index + 1, trimmed.take(MAX_SIGNATURE))
                return@forEachIndexed
            }
            // 只收模块级变量，避免把函数体内的局部变量当成“定义”污染结果
            if (line.isNotEmpty() && !line.first().isWhitespace()) {
                PY_ASSIGN.find(line)?.let { match ->
                    result += Definition(path, match.groupValues[1], "变量", index + 1, trimmed.take(MAX_SIGNATURE))
                }
            }
        }
        return result
    }

    /** 从 `from x import y` / `import x.y` 里提取可能对应的模块文件。 */
    private fun importHints(text: String): Set<String> {
        val hints = LinkedHashSet<String>()
        IMPORT.findAll(text).forEach { match ->
            val module = match.groupValues[1].ifBlank { match.groupValues[2] }
            if (module.isNotBlank()) {
                hints += module.replace('.', '/')
                hints += module.substringAfterLast('.').replace('.', '/')
            }
        }
        return hints
    }

    private fun matchesImport(path: String, hints: Set<String>): Boolean {
        val noExt = path.removeSuffix(".py")
        return hints.any { hint ->
            noExt == hint || noExt.endsWith("/$hint")
        }
    }

    private fun isIdentifierPart(ch: Char): Boolean =
        ch.isLetterOrDigit() || ch == '_' || ch == '$'

    companion object {
        private const val MAX_FILES = 300
        private const val MAX_BYTES = 512L * 1024
        private const val MAX_SIGNATURE = 160

        private val IDENTIFIER = Regex("""[A-Za-z_]\w*""")
        private val PY_CLASS = Regex("""^\s*class\s+([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*:""")
        private val PY_DEF = Regex("""^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(""")
        private val PY_ASSIGN = Regex("""^([A-Za-z_]\w*)\s*=(?!=)""")
        private val IMPORT = Regex("""(?m)^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))""")
    }
}
