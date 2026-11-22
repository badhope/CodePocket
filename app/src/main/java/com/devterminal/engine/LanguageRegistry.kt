package com.devterminal.engine

import java.io.File

/** 运行级 = 有解释器，能执行；编辑级 = 只有语法高亮/补全，不能执行。 */
enum class LanguageTier { RUN, EDIT }

/** 补全词表使用的语言档案，和 runtime 解耦。 */
enum class CompletionProfile {
    PYTHON, JAVASCRIPT, LUA, JAVA, KOTLIN, TYPESCRIPT, PLAIN
}

/**
 * 单一事实源：语言 id、显示名、扩展名、语法文件、补全档案、运行时 id。
 *
 * 之前这些信息散落在 EditorViewModel / EditorScreen / ProjectManager /
 * CompletionProvider / Snippets / Templates / RunModels / languages.json
 * 八处，新增一种语言要改八个文件，且 .js 会被当成 Python。
 * 现在只改这里。
 */
data class LanguageSpec(
    val id: String,
    val displayName: String,
    val extensions: List<String>,
    val tier: LanguageTier,
    val grammarName: String?,
    val completionProfile: CompletionProfile = CompletionProfile.PLAIN,
    val runtimeId: String? = null,
    val commentPrefix: String = "#"
) {
    val isRunnable: Boolean get() = tier == LanguageTier.RUN && runtimeId != null
}

object LanguageRegistry {

    // ===== 3 种运行级 =====
    val PYTHON = LanguageSpec(
        id = "python",
        displayName = "Python",
        extensions = listOf("py", "pyw"),
        tier = LanguageTier.RUN,
        grammarName = "python",
        completionProfile = CompletionProfile.PYTHON,
        runtimeId = "python",
        commentPrefix = "#"
    )

    val JAVASCRIPT = LanguageSpec(
        id = "javascript",
        displayName = "JavaScript",
        extensions = listOf("js", "mjs", "cjs"),
        tier = LanguageTier.RUN,
        grammarName = "js",
        completionProfile = CompletionProfile.JAVASCRIPT,
        runtimeId = "javascript",
        commentPrefix = "//"
    )

    val LUA = LanguageSpec(
        id = "lua",
        displayName = "Lua",
        extensions = listOf("lua"),
        tier = LanguageTier.RUN,
        grammarName = "lua",
        completionProfile = CompletionProfile.LUA,
        runtimeId = "lua",
        commentPrefix = "--"
    )

    // ===== 17 种编辑级 =====
    val JAVA = LanguageSpec("java", "Java", listOf("java"), LanguageTier.EDIT, "java", CompletionProfile.JAVA, commentPrefix = "//")
    val KOTLIN = LanguageSpec("kotlin", "Kotlin", listOf("kt", "kts"), LanguageTier.EDIT, "kotlin", CompletionProfile.KOTLIN, commentPrefix = "//")
    val TYPESCRIPT = LanguageSpec("typescript", "TypeScript", listOf("ts", "tsx"), LanguageTier.EDIT, "ts", CompletionProfile.TYPESCRIPT, commentPrefix = "//")
    val JSON = LanguageSpec("json", "JSON", listOf("json", "json5"), LanguageTier.EDIT, "json", CompletionProfile.PLAIN, commentPrefix = "//")
    val MARKDOWN = LanguageSpec("markdown", "Markdown", listOf("md", "markdown"), LanguageTier.EDIT, "markdown", CompletionProfile.PLAIN)
    val HTML = LanguageSpec("html", "HTML", listOf("html", "htm"), LanguageTier.EDIT, "html", CompletionProfile.PLAIN, commentPrefix = "<!--")
    val CSS = LanguageSpec("css", "CSS", listOf("css", "scss", "less"), LanguageTier.EDIT, "css", CompletionProfile.PLAIN, commentPrefix = "/*")
    val SHELL = LanguageSpec("shell", "Shell", listOf("sh", "bash", "zsh"), LanguageTier.EDIT, "sh", CompletionProfile.PLAIN, commentPrefix = "#")
    val XML = LanguageSpec("xml", "XML", listOf("xml", "svg"), LanguageTier.EDIT, "xml", CompletionProfile.PLAIN, commentPrefix = "<!--")
    val YAML = LanguageSpec("yaml", "YAML", listOf("yml", "yaml"), LanguageTier.EDIT, "yaml", CompletionProfile.PLAIN, commentPrefix = "#")
    val SQL = LanguageSpec("sql", "SQL", listOf("sql"), LanguageTier.EDIT, "sql", CompletionProfile.PLAIN, commentPrefix = "--")
    val C = LanguageSpec("c", "C", listOf("c", "h"), LanguageTier.EDIT, "c", CompletionProfile.PLAIN, commentPrefix = "//")
    val CPP = LanguageSpec("cpp", "C++", listOf("cpp", "cc", "cxx", "hpp", "hh"), LanguageTier.EDIT, "cpp", CompletionProfile.PLAIN, commentPrefix = "//")
    val GO = LanguageSpec("go", "Go", listOf("go"), LanguageTier.EDIT, "go", CompletionProfile.PLAIN, commentPrefix = "//")
    val RUST = LanguageSpec("rust", "Rust", listOf("rs"), LanguageTier.EDIT, "rust", CompletionProfile.PLAIN, commentPrefix = "//")
    val INI = LanguageSpec("ini", "INI / TOML", listOf("ini", "toml", "conf"), LanguageTier.EDIT, null, CompletionProfile.PLAIN, commentPrefix = "#")
    val TEXT = LanguageSpec("text", "纯文本", listOf("txt", "log"), LanguageTier.EDIT, null, CompletionProfile.PLAIN)

    val runnable: List<LanguageSpec> = listOf(PYTHON, JAVASCRIPT, LUA)
    val editable: List<LanguageSpec> = listOf(
        JAVA, KOTLIN, TYPESCRIPT, JSON, MARKDOWN, HTML, CSS, SHELL, XML,
        YAML, SQL, C, CPP, GO, RUST, INI, TEXT
    )
    val all: List<LanguageSpec> = runnable + editable

    private val byId: Map<String, LanguageSpec> = all.associateBy { it.id }
    private val byExtension: Map<String, LanguageSpec> =
        all.flatMap { spec -> spec.extensions.map { it.lowercase() to spec } }.toMap()

    fun spec(id: String?): LanguageSpec = byId[id] ?: TEXT

    fun forFile(file: File?): LanguageSpec {
        val ext = file?.extension?.lowercase().orEmpty()
        return byExtension[ext] ?: TEXT
    }

    fun labelOf(file: File?): String = forFile(file).displayName

    /** 可运行文件（按 runnable 语言的扩展名判断） */
    fun isRunnable(file: File?): Boolean = forFile(file).isRunnable

    /** 全局搜索/文件树可识别的文本扩展名 */
    val searchableExtensions: Set<String> =
        all.flatMap { it.extensions }.map { it.lowercase() }.toSet()

    /** 兼容旧项目的 .devterminal 标记：PYTHON/JAVA → python/java */
    fun migrateLegacyId(raw: String): String = when (raw.trim().uppercase()) {
        "PYTHON" -> PYTHON.id
        "JAVA" -> JAVA.id
        else -> raw.trim().lowercase().ifBlank { PYTHON.id }
    }
}
