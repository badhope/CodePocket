package com.devterminal.engine

/**
 * 静态代码补全数据源。
 *
 * 为什么不接 LSP：完整的 language server 是独立进程 + JSON-RPC，在手机上
 * 内存和启动开销都不划算，而且离线场景下补全需求主要是「关键字 + 常见库符号」。
 * 这里用静态词表覆盖 80% 的日常场景，零进程开销。
 *
 * 语言档案由 [LanguageRegistry] 的 [CompletionProfile] 提供，不再和运行枚举耦合。
 */
object CompletionProvider {

    /** 补全项 */
    data class Item(val text: String, val kind: Kind, val detail: String = "")

    enum class Kind { KEYWORD, BUILTIN, MODULE, CLASS, METHOD }

    private val PY_KEYWORDS = listOf(
        "def", "class", "return", "if", "elif", "else", "for", "while", "break",
        "continue", "import", "from", "as", "try", "except", "finally", "raise",
        "with", "lambda", "yield", "global", "nonlocal", "pass", "assert", "del",
        "in", "not", "and", "or", "is", "None", "True", "False", "async", "await"
    )

    private val PY_BUILTINS = listOf(
        "print", "len", "range", "int", "str", "float", "list", "dict", "set",
        "tuple", "bool", "input", "open", "enumerate", "zip", "map", "filter",
        "sorted", "sum", "min", "max", "abs", "round", "type", "isinstance",
        "hasattr", "getattr", "setattr", "super", "format", "repr", "id", "hash"
    )

    private val PY_MODULES = listOf(
        "math", "random", "os", "sys", "json", "time", "datetime", "re",
        "collections", "itertools", "functools", "typing"
    )

    private val PY_MODULE_METHODS = mapOf(
        "math" to listOf("sqrt", "pow", "floor", "ceil", "pi", "e", "sin", "cos", "tan", "log", "exp"),
        "random" to listOf("random", "randint", "choice", "shuffle", "uniform", "seed", "sample"),
        "os" to listOf("path", "getcwd", "listdir", "mkdir", "remove", "environ", "system"),
        "json" to listOf("dumps", "loads", "dump", "load"),
        "time" to listOf("time", "sleep", "strftime", "localtime"),
        "re" to listOf("match", "search", "findall", "sub", "compile", "split")
    )

    private val JAVA_KEYWORDS = listOf(
        "public", "private", "protected", "static", "final", "class", "interface",
        "extends", "implements", "return", "if", "else", "for", "while", "do",
        "switch", "case", "default", "break", "continue", "new", "this", "super",
        "try", "catch", "finally", "throw", "throws", "import", "package",
        "void", "int", "long", "double", "float", "boolean", "char", "String",
        "byte", "short", "null", "true", "false", "abstract", "synchronized"
    )

    private val JAVA_CLASSES = listOf(
        "System", "String", "Integer", "Double", "Math", "List", "ArrayList",
        "Map", "HashMap", "Set", "HashSet", "Scanner", "Arrays", "Collections",
        "StringBuilder", "Object", "Exception", "RuntimeException"
    )

    private val JAVA_METHODS = mapOf(
        "System" to listOf("out.println", "out.print", "out.printf", "err.println", "exit", "currentTimeMillis"),
        "String" to listOf("length()", "charAt()", "substring()", "indexOf()", "split()", "trim()", "toUpperCase()", "toLowerCase()", "equals()", "contains()", "replace()"),
        "Math" to listOf("abs", "max", "min", "pow", "sqrt", "random", "round", "floor", "ceil", "PI", "E"),
        "List" to listOf("add()", "get()", "size()", "remove()", "contains()", "isEmpty()", "clear()"),
        "Map" to listOf("put()", "get()", "containsKey()", "keySet()", "values()", "size()", "remove()")
    )

    private val JS_KEYWORDS = listOf(
        "function", "return", "if", "else", "for", "while", "do", "switch", "case",
        "break", "continue", "const", "let", "var", "class", "extends", "new", "this",
        "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of",
        "async", "await", "yield", "null", "undefined", "true", "false"
    )

    private val JS_BUILTINS = listOf(
        "console", "log", "print", "input", "Math", "JSON", "Array", "Object",
        "String", "Number", "Boolean", "Date", "RegExp", "Map", "Set", "Promise",
        "parseInt", "parseFloat", "isNaN", "encodeURIComponent", "decodeURIComponent"
    )

    private val JS_METHODS = listOf(
        "map", "filter", "reduce", "forEach", "find", "some", "every", "push",
        "pop", "slice", "splice", "join", "split", "replace", "includes",
        "indexOf", "trim", "toUpperCase", "toLowerCase", "keys", "values", "entries"
    )

    private val LUA_KEYWORDS = listOf(
        "function", "return", "if", "then", "else", "elseif", "end", "for", "while",
        "repeat", "until", "do", "local", "break", "in", "and", "or", "not",
        "nil", "true", "false", "goto"
    )

    private val LUA_BUILTINS = listOf(
        "print", "input", "type", "tostring", "tonumber", "pairs", "ipairs",
        "next", "select", "pcall", "xpcall", "error", "assert", "setmetatable",
        "getmetatable", "rawget", "rawset", "table", "string", "math", "io", "os"
    )

    private val LUA_METHODS = listOf(
        "insert", "remove", "concat", "sort", "sub", "upper", "lower", "len",
        "format", "find", "match", "gsub", "gmatch", "random", "floor", "ceil",
        "sqrt", "abs", "max", "min", "time", "clock"
    )

    // 静态词表是常量，没必要每次弹补全都重建一遍
    private val PY_BASE: List<Item> by lazy { buildPyItems() }
    private val JAVA_BASE: List<Item> by lazy { buildJavaItems() }
    private val JS_BASE: List<Item> by lazy { buildJsItems() }
    private val LUA_BASE: List<Item> by lazy { buildLuaItems() }

    // 文档符号按「语言 + 文本哈希」缓存：正则扫全文很贵，但同一次编辑里文本大多没变
    @Volatile private var docCacheKey = 0
    @Volatile private var docCacheLang: CompletionProfile? = null
    @Volatile private var docCacheValue: List<Item> = emptyList()

    /**
     * 获取补全候选。
     * @param profile 补全档案（由 LanguageRegistry 给出）
     * @param prefix 当前已输入的前缀（用于过滤）
     * @param documentText 当前文档全文（用于提取用户自定义符号）
     */
    fun candidates(
        profile: CompletionProfile,
        prefix: String,
        documentText: String
    ): List<Item> {
        val key = 31 * profile.hashCode() + documentText.hashCode()
        val docSymbols = if (key == docCacheKey && profile == docCacheLang) {
            docCacheValue
        } else {
            val fresh = when (profile) {
                CompletionProfile.PYTHON -> extractPySymbols(documentText)
                CompletionProfile.JAVA -> extractJavaSymbols(documentText)
                CompletionProfile.JAVASCRIPT, CompletionProfile.TYPESCRIPT -> extractJsSymbols(documentText)
                CompletionProfile.LUA -> extractLuaSymbols(documentText)
                CompletionProfile.KOTLIN -> extractJavaSymbols(documentText)
                CompletionProfile.PLAIN -> emptyList()
            }
            docCacheKey = key
            docCacheLang = profile
            docCacheValue = fresh
            fresh
        }
        val base = when (profile) {
            CompletionProfile.PYTHON -> PY_BASE
            CompletionProfile.JAVA, CompletionProfile.KOTLIN -> JAVA_BASE
            CompletionProfile.JAVASCRIPT, CompletionProfile.TYPESCRIPT -> JS_BASE
            CompletionProfile.LUA -> LUA_BASE
            CompletionProfile.PLAIN -> emptyList()
        } + docSymbols
        val p = prefix.trim()
        val filtered = if (p.isEmpty()) base else base.filter { it.text.startsWith(p, ignoreCase = true) }
        // 前缀完全匹配的排前面，其余按字母序
        return filtered
            .sortedWith(compareBy({ !it.text.startsWith(p) }, { it.text.length }, { it.text }))
            .take(60)
    }

    private fun buildPyItems(): List<Item> = buildList {
        PY_KEYWORDS.forEach { add(Item(it, Kind.KEYWORD, "关键字")) }
        PY_BUILTINS.forEach { add(Item(it, Kind.BUILTIN, "内置函数")) }
        PY_MODULES.forEach { add(Item(it, Kind.MODULE, "标准库")) }
        PY_MODULE_METHODS.forEach { (mod, methods) ->
            methods.forEach { add(Item(it, Kind.METHOD, "$mod 模块")) }
        }
    }

    private fun buildJavaItems(): List<Item> = buildList {
        JAVA_KEYWORDS.forEach { add(Item(it, Kind.KEYWORD, "关键字")) }
        JAVA_CLASSES.forEach { add(Item(it, Kind.CLASS, "常用类")) }
        JAVA_METHODS.forEach { (cls, methods) ->
            methods.forEach { add(Item(it, Kind.METHOD, "$cls 方法")) }
        }
    }

    private fun buildJsItems(): List<Item> = buildList {
        JS_KEYWORDS.forEach { add(Item(it, Kind.KEYWORD, "关键字")) }
        JS_BUILTINS.forEach { add(Item(it, Kind.BUILTIN, "内置对象")) }
        JS_METHODS.forEach { add(Item(it, Kind.METHOD, "常用方法")) }
    }

    private fun buildLuaItems(): List<Item> = buildList {
        LUA_KEYWORDS.forEach { add(Item(it, Kind.KEYWORD, "关键字")) }
        LUA_BUILTINS.forEach { add(Item(it, Kind.BUILTIN, "内置函数")) }
        LUA_METHODS.forEach { add(Item(it, Kind.METHOD, "常用方法")) }
    }

    /** 从 Python 文档里抽取用户定义的函数/类名 */
    private fun extractPySymbols(text: String): List<Item> {
        val items = mutableListOf<Item>()
        Regex("""(?m)^\s*def\s+(\w+)""").findAll(text).forEach {
            items.add(Item(it.groupValues[1], Kind.METHOD, "本文件函数"))
        }
        Regex("""(?m)^\s*class\s+(\w+)""").findAll(text).forEach {
            items.add(Item(it.groupValues[1], Kind.CLASS, "本文件类"))
        }
        Regex("""(?m)^\s*(\w+)\s*=\s*""").findAll(text).take(20).forEach {
            val name = it.groupValues[1]
            if (name.length > 1 && name !in PY_KEYWORDS) {
                items.add(Item(name, Kind.BUILTIN, "变量"))
            }
        }
        return items.toList()
    }

    /** 从 Java 文档里抽取类名与方法名 */
    private fun extractJavaSymbols(text: String): List<Item> {
        val items = mutableListOf<Item>()
        Regex("""\bclass\s+(\w+)""").findAll(text).forEach {
            items.add(Item(it.groupValues[1], Kind.CLASS, "本文件类"))
        }
        Regex("""\b(?:public|private|protected)?\s*(?:static\s+)?(?:\w+)\s+(\w+)\s*\(""")
            .findAll(text).take(30).forEach {
                val name = it.groupValues[1]
                if (name !in JAVA_KEYWORDS && name.length > 1) {
                    items.add(Item(name, Kind.METHOD, "本文件方法"))
                }
            }
        return items.toList()
    }

    /** 从 JS 文档里抽取函数/类/常量名 */
    private fun extractJsSymbols(text: String): List<Item> {
        val items = mutableListOf<Item>()
        Regex("""\bfunction\s+(\w+)""").findAll(text).forEach {
            items.add(Item(it.groupValues[1], Kind.METHOD, "本文件函数"))
        }
        Regex("""\bclass\s+(\w+)""").findAll(text).forEach {
            items.add(Item(it.groupValues[1], Kind.CLASS, "本文件类"))
        }
        Regex("""\b(?:const|let|var)\s+(\w+)""").findAll(text).take(20).forEach {
            items.add(Item(it.groupValues[1], Kind.BUILTIN, "变量"))
        }
        return items.toList()
    }

    /** 从 Lua 文档里抽取 function 名 */
    private fun extractLuaSymbols(text: String): List<Item> {
        val items = mutableListOf<Item>()
        Regex("""\bfunction\s+([\w.:]+)""").findAll(text).forEach {
            items.add(Item(it.groupValues[1], Kind.METHOD, "本文件函数"))
        }
        Regex("""\blocal\s+(\w+)\s*=\s*""").findAll(text).take(20).forEach {
            items.add(Item(it.groupValues[1], Kind.BUILTIN, "变量"))
        }
        return items.toList()
    }
}
