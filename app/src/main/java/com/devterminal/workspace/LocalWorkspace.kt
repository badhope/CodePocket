package com.devterminal.workspace

import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.UUID

/**
 * 本地项目工作区，所有文件访问都限制在 root 之内。
 *
 * 路径先 canonical 化再比较，防止 `../` 和符号链接跳出项目目录。
 */
class LocalWorkspace(rootDir: File) : Workspace {
    override val root: File = try {
        rootDir.canonicalFile
    } catch (e: IOException) {
        throw IllegalArgumentException("Cannot resolve workspace root: ${rootDir.path}", e)
    }

    init {
        require(root.isDirectory) { "Workspace root is not a directory: ${root.path}" }
    }

    override fun resolve(path: String): File {
        val raw = path.trim()
        require(raw.isNotEmpty()) { "Path is empty" }
        require(!raw.contains('\u0000')) { "Path contains NUL" }

        val candidate = File(raw).let { if (it.isAbsolute) it else File(root, raw) }
        val canonical = try {
            candidate.canonicalFile
        } catch (e: IOException) {
            throw SecurityException("Cannot resolve path: $path", e)
        }

        val rootPath = root.path
        val prefix = rootPath + File.separator
        val allowed = canonical.path == rootPath || canonical.path.startsWith(prefix)
        if (!allowed) throw SecurityException("Path escapes workspace: $path")
        return canonical
    }

    override fun readText(path: String, startLine: Int, maxLines: Int): TextWindow {
        require(maxLines in 1..500) { "maxLines must be 1..500" }
        val file = resolve(path)
        require(file.isFile) { "Not a file: $path" }
        require(file.length() <= MAX_TEXT_BYTES) {
            "File too large for text read: $path (${file.length()} bytes)"
        }
        if (isProbablyBinary(file)) {
            throw IllegalArgumentException("Binary file cannot be read as text: $path")
        }

        val lines = file.readLines()
        val total = lines.size
        val start = startLine.coerceAtLeast(1)
        if (total == 0 || start > total) {
            return TextWindow(
                path = relativePath(file),
                startLine = start,
                endLine = start - 1,
                totalLines = total,
                content = "",
                truncated = false,
            )
        }

        val end = (start + maxLines - 1).coerceAtMost(total)
        val content = lines.subList(start - 1, end).joinToString("\n")
        return TextWindow(
            path = relativePath(file),
            startLine = start,
            endLine = end,
            totalLines = total,
            content = content,
            truncated = end < total,
        )
    }

    override fun writeBytes(path: String, bytes: ByteArray) {
        val target = resolve(path)
        require(!target.isDirectory) { "Cannot write a directory: $path" }
        val parent = target.parentFile
            ?: throw IllegalArgumentException("Path has no parent: $path")
        if (!parent.exists() && !parent.mkdirs()) {
            throw IOException("Cannot create directory: ${parent.path}")
        }

        val temp = File(parent, ".${target.name}.tmp-${UUID.randomUUID()}")
        try {
            FileOutputStream(temp).use { out ->
                out.write(bytes)
                out.fd.sync()
            }
            if (!temp.renameTo(target)) {
                // 某些文件系统不允许 rename 覆盖已有文件，退化为覆盖写。
                target.outputStream().use { it.write(bytes) }
            }
        } finally {
            if (temp.exists()) temp.delete()
        }
    }

    override fun listFiles(maxDepth: Int, maxEntries: Int): List<String> {
        require(maxDepth in 0..20) { "maxDepth must be 0..20" }
        require(maxEntries in 1..5000) { "maxEntries must be 1..5000" }
        val result = ArrayList<String>(minOf(maxEntries, 256))
        walk(root, 0, maxDepth, maxEntries, result)
        return result
    }

    override fun search(query: String, glob: String?, maxResults: Int): List<SearchHit> {
        require(query.isNotBlank()) { "Search query is blank" }
        require(maxResults in 1..200) { "maxResults must be 1..200" }
        val matcher = glob?.let { globToRegex(it) }
        val hits = ArrayList<SearchHit>(minOf(maxResults, 64))

        for (relative in listFiles(maxDepth = 10, maxEntries = 1000)) {
            if (hits.size >= maxResults) break
            val file = resolve(relative)
            if (!file.isFile || file.length() > MAX_SEARCH_BYTES || isProbablyBinary(file)) continue
            val displayName = file.name
            if (matcher != null && !matcher.matches(displayName) && !matcher.matches(relative)) continue

            val lines = runCatching { file.readLines() }.getOrNull() ?: continue
            for ((index, line) in lines.withIndex()) {
                if (line.contains(query, ignoreCase = true)) {
                    hits += SearchHit(relative, index + 1, line.take(240))
                    if (hits.size >= maxResults) break
                }
            }
        }
        return hits
    }

    override fun replaceLines(
        path: String,
        startLine: Int,
        endLine: Int,
        replacement: String,
    ): TextWindow {
        val file = resolve(path)
        require(file.isFile) { "Not a file: $path" }
        require(file.length() <= MAX_TEXT_BYTES) {
            "File too large for line replacement: $path (${file.length()} bytes)"
        }
        val lines = file.readLines()
        val total = lines.size
        require(startLine in 1..(total + 1)) { "startLine out of range: $startLine (total=$total)" }
        require(endLine in 0..total) { "endLine out of range: $endLine (total=$total)" }
        require(startLine <= endLine + 1) { "startLine must be <= endLine + 1" }

        val replacementLines = if (replacement.isEmpty()) {
            emptyList()
        } else {
            replacement.split('\n')
        }
        val before = lines.take(startLine - 1)
        val after = if (endLine == 0) lines else lines.drop(endLine)
        val newLines = before + replacementLines + after
        writeText(path, newLines.joinToString("\n"))
        return readText(
            path = path,
            startLine = (startLine - 3).coerceAtLeast(1),
            maxLines = 40,
        )
    }

    private fun walk(dir: File, depth: Int, maxDepth: Int, maxEntries: Int, out: MutableList<String>) {
        if (out.size >= maxEntries) return
        val children = dir.listFiles()?.sortedBy { it.name } ?: return
        for (child in children) {
            if (out.size >= maxEntries) return
            if (child.isDirectory) {
                if (depth >= maxDepth) continue
                if (child.name in SKIP_DIRS) continue
                walk(child, depth + 1, maxDepth, maxEntries, out)
            } else if (child.isFile && child.name !in SKIP_FILES) {
                out += relativePath(child)
            }
        }
    }

    private fun relativePath(file: File): String =
        file.relativeTo(root).path.replace(File.separatorChar, '/')

    private fun globToRegex(glob: String): Regex {
        val body = buildString {
            glob.forEach { ch ->
                when (ch) {
                    '*' -> append(".*")
                    '?' -> append('.')
                    else -> append(Regex.escape(ch.toString()))
                }
            }
        }
        return Regex("^$body$")
    }

    private fun isProbablyBinary(file: File): Boolean {
        return runCatching {
            file.inputStream().use { input ->
                val buffer = ByteArray(4096)
                val read = input.read(buffer)
                if (read <= 0) return@use false
                (0 until read).any { buffer[it] == 0.toByte() }
            }
        }.getOrDefault(true)
    }

    companion object {
        private const val MAX_TEXT_BYTES = 2L * 1024 * 1024
        private const val MAX_SEARCH_BYTES = 512L * 1024

        private val SKIP_DIRS = setOf(
            ".git", ".gradle", ".idea", ".codepocket",
            "build", "node_modules", "__pycache__", ".venv", "venv",
        )
        private val SKIP_FILES = setOf(".DS_Store")
    }
}
