package com.devterminal.agent

import com.devterminal.workspace.Workspace
import java.io.File
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * 离线语义索引（TF-IDF + 余弦相似度），不依赖网络、不下载 embedding 模型。
 *
 * 它不是神经网络 embedding：对中文按字、对代码按标识符切词，适合在手机上
 * 用“登录 校验”“MCP resource”这类概念找相关代码块，再交给 read_file 精读。
 * 索引按工作区懒构建，一次 Agent 运行内复用；文件数/块数都有硬上限，避免扫描爆内存。
 */
class SemanticIndex(
    private val workspace: Workspace,
    private val maxFiles: Int = 500,
    private val maxChunks: Int = 1600,
) {
    data class Chunk(
        val path: String,
        val startLine: Int,
        val endLine: Int,
        val preview: String,
        val vector: Map<String, Double>,
        val norm: Double,
    )

    data class Hit(val path: String, val startLine: Int, val endLine: Int, val score: Double, val preview: String)

    private data class RawChunk(val path: String, val startLine: Int, val endLine: Int, val text: String)

    @Volatile
    private var chunks: List<Chunk>? = null

    fun search(query: String, limit: Int = 8): List<Hit> {
        val terms = tokenize(query)
        if (terms.isEmpty()) return emptyList()
        val index = ensureIndex()
        if (index.isEmpty()) return emptyList()
        val total = index.size.coerceAtLeast(1)
        val qVector = terms.groupingBy { it }.eachCount().mapValues { (term, tf) ->
            val df = index.count { it.vector.containsKey(term) }.coerceAtLeast(1)
            (1.0 + ln(tf.toDouble())) * ln((1.0 + total) / (1.0 + df))
        }
        val qNorm = sqrt(qVector.values.sumOf { it * it })
        if (qNorm == 0.0) return emptyList()
        return index.asSequence()
            .map { chunk ->
                var dot = 0.0
                for ((term, weight) in qVector) dot += weight * (chunk.vector[term] ?: 0.0)
                Hit(chunk.path, chunk.startLine, chunk.endLine, dot / (qNorm * chunk.norm), chunk.preview)
            }
            .filter { it.score > 0.0 }
            .sortedByDescending { it.score }
            .take(limit.coerceIn(1, 12))
            .toList()
    }

    private fun ensureIndex(): List<Chunk> {
        chunks?.let { return it }
        synchronized(this) {
            chunks?.let { return it }
            val raw = buildRawChunks()
            val df = mutableMapOf<String, Int>()
            val tokenized = raw.map { tokenize(it.text) }
            tokenized.forEach { tokens ->
                tokens.toSet().forEach { df[it] = (df[it] ?: 0) + 1 }
            }
            val total = raw.size.coerceAtLeast(1)
            val built = raw.zip(tokenized).map { (chunk, tokens) ->
                val counts = tokens.groupingBy { it }.eachCount()
                val vector = counts.mapValues { (token, tf) ->
                    (1.0 + ln(tf.toDouble())) * ln((1.0 + total) / (1.0 + (df[token] ?: 0)))
                }.filterValues { it > 0.0 }
                val norm = sqrt(vector.values.sumOf { it * it }).coerceAtLeast(1e-9)
                Chunk(chunk.path, chunk.startLine, chunk.endLine, chunk.text.take(240), vector, norm)
            }
            chunks = built
            return built
        }
    }

    private fun buildRawChunks(): List<RawChunk> {
        val result = ArrayList<RawChunk>()
        for (path in workspace.listFiles(maxDepth = 10, maxEntries = maxFiles)) {
            if (result.size >= maxChunks) break
            if (path.substringAfterLast('.', "").lowercase() !in TEXT_EXTENSIONS) continue
            val file = runCatching { workspace.resolve(path) }.getOrNull() ?: continue
            if (!file.isFile || file.length() > MAX_FILE_BYTES) continue
            val window = runCatching { workspace.readText(path, 1, 500) }.getOrNull() ?: continue
            val lines = window.content.split('\n')
            var start = 0
            while (start < lines.size && result.size < maxChunks) {
                val end = (start + CHUNK_LINES).coerceAtMost(lines.size)
                val text = lines.subList(start, end).joinToString("\n")
                if (text.isNotBlank()) {
                    result += RawChunk(path, window.startLine + start, window.startLine + end - 1, text)
                }
                start = end
            }
        }
        return result
    }

    private fun tokenize(text: String): List<String> {
        val out = ArrayList<String>(64)
        TOKEN.findAll(text).forEach { m ->
            val raw = m.value
            if (raw.length >= 2 || raw[0].code > 0x2E80) out += raw.lowercase()
        }
        return out
    }

    companion object {
        private const val CHUNK_LINES = 60
        private const val MAX_FILE_BYTES = 512 * 1024
        private val TEXT_EXTENSIONS = setOf(
            "kt", "kts", "java", "py", "js", "ts", "tsx", "jsx", "lua", "c", "h", "cpp", "hpp",
            "md", "txt", "json", "yaml", "yml", "toml", "gradle", "xml", "html", "css", "sh",
        )
        private val TOKEN = Regex("[A-Za-z_][A-Za-z0-9_]+|\\p{IsHan}")
    }
}
