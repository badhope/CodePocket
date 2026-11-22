package com.devterminal.workspace

import java.io.File

data class TextWindow(
    val path: String,
    val startLine: Int,
    val endLine: Int,
    val totalLines: Int,
    val content: String,
    val truncated: Boolean,
) {
    fun numbered(): String {
        if (content.isEmpty()) return ""
        val lines = content.split('\n')
        return lines.mapIndexed { index, line -> "${startLine + index}\t$line" }.joinToString("\n")
    }
}

data class SearchHit(
    val path: String,
    val line: Int,
    val text: String,
)

/**
 * 项目工作区。所有路径都必须先经过 resolve() 的根目录校验，
 * 工具不能直接拿 File 绕过路径监狱。
 */
interface Workspace {
    val root: File

    fun resolve(path: String): File

    fun readText(path: String, startLine: Int = 1, maxLines: Int = 200): TextWindow

    fun writeBytes(path: String, bytes: ByteArray)

    fun writeText(path: String, text: String) {
        writeBytes(path, text.toByteArray(Charsets.UTF_8))
    }

    fun listFiles(maxDepth: Int = 4, maxEntries: Int = 500): List<String>

    fun search(query: String, glob: String? = null, maxResults: Int = 50): List<SearchHit>

    fun replaceLines(path: String, startLine: Int, endLine: Int, replacement: String): TextWindow
}
