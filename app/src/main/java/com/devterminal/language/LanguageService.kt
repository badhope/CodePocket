package com.devterminal.language

import com.devterminal.workspace.Workspace

data class CodeSymbol(
    val name: String,
    val kind: String,
    val line: Int,
    val signature: String = "",
)

/**
 * 轻量语言服务：不跑 LSP，只做当前文件的大纲与符号扫描。
 *
 * 手机 IDE 的痛点不是“没有语义补全”，而是几十行以上就找不到函数。
 * 这里用正则给出稳定的函数/类/方法列表，点一下跳过去；
 * 后续接 tree-sitter 时可以替换实现，UI 契约不变。
 */
class LanguageService(private val workspace: Workspace) {

    fun outline(path: String, maxLines: Int = 500): List<CodeSymbol> {
        val window = runCatching { workspace.readText(path, 1, maxLines) }.getOrNull() ?: return emptyList()
        val language = languageOf(path)
        val text = window.content
        val lines = text.lines()
        val symbols = mutableListOf<CodeSymbol>()

        when (language) {
            "Python" -> {
                lines.forEachIndexed { index, line ->
                    val trimmed = line.trimStart()
                    if (trimmed.startsWith("class ") || trimmed.startsWith("def ") || trimmed.startsWith("async def ")) {
                        val kind = if (trimmed.startsWith("class ")) "类" else "函数"
                        val name = trimmed
                            .removePrefix("async ").removePrefix("def ").removePrefix("class ")
                            .substringBefore('(').substringBefore(':').trim()
                        if (name.isNotEmpty()) symbols += CodeSymbol(name, kind, index + 1, line.trim().take(140))
                    }
                }
            }
            "Kotlin", "Java" -> {
                lines.forEachIndexed { index, line ->
                    val trimmed = line.trim()
                    val classMatch = CLASS_PATTERN.find(trimmed)
                    if (classMatch != null) {
                        symbols += CodeSymbol(classMatch.groupValues[1], "类", index + 1, trimmed.take(140))
                    }
                    val funMatch = FUN_PATTERN.find(trimmed)
                    if (funMatch != null) {
                        val name = funMatch.groupValues[1]
                        if (name.isNotEmpty()) symbols += CodeSymbol(name, "函数", index + 1, trimmed.take(140))
                    }
                }
            }
            "JavaScript", "TypeScript" -> {
                lines.forEachIndexed { index, line ->
                    val trimmed = line.trim()
                    JS_CLASS.find(trimmed)?.let {
                        symbols += CodeSymbol(it.groupValues[1], "类", index + 1, trimmed.take(140))
                    }
                    JS_FUN.find(trimmed)?.let {
                        symbols += CodeSymbol(it.groupValues[1], "函数", index + 1, trimmed.take(140))
                    }
                }
            }
            "Lua" -> {
                lines.forEachIndexed { index, line ->
                    LUA_FUN.find(line.trim())?.let {
                        symbols += CodeSymbol(it.groupValues[1], "函数", index + 1, line.trim().take(140))
                    }
                }
            }
        }
        return symbols.distinctBy { "${it.name}@${it.line}" }.take(120)
    }

    private fun languageOf(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
        "py" -> "Python"
        "kt", "kts" -> "Kotlin"
        "java" -> "Java"
        "js", "mjs", "cjs" -> "JavaScript"
        "ts", "tsx" -> "TypeScript"
        "lua" -> "Lua"
        else -> ""
    }

    companion object {
        private val CLASS_PATTERN = Regex("""(?:class|interface|object|enum class)\s+([A-Za-z_]\w*)""")
        private val FUN_PATTERN = Regex("""\bfun\s+([A-Za-z_]\w*)""")
        private val JS_CLASS = Regex("""\bclass\s+([A-Za-z_$][\w$]*)""")
        private val JS_FUN = Regex("""(?:\bfunction\s+|\b(?:const|let|var)\s+)([A-Za-z_$][\w$]*)""")
        private val LUA_FUN = Regex("""(?:local\s+)?function\s+([A-Za-z_][\w.:]*)""" )
    }
}
