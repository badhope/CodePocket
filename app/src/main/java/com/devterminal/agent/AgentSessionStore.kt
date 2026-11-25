package com.devterminal.agent

import org.json.JSONObject
import java.io.File
import java.util.UUID

data class AgentSessionMeta(
    val id: String,
    val task: String,
    val projectPath: String,
    val startedAt: Long,
    val lastAt: Long,
    val eventCount: Int,
    val finished: Boolean,
)

/**
 * Agent 会话 JSONL 仓库。
 *
 * 文件结构：
 *   <id>.jsonl
 *   第一行：{"type":"session_meta","id":...}
 *   之后：AgentEvent 一行一条
 *
 * 只追加不覆盖；UI 回放、会话恢复、出问题排查都读同一份日志。
 */
class AgentSessionStore(private val dir: File) {

    fun create(projectPath: String, task: String): String {
        ensureDir()
        val id = "${System.currentTimeMillis()}-${UUID.randomUUID().toString().take(8)}"
        val meta = JSONObject()
            .put("type", "session_meta")
            .put("id", id)
            .put("task", task.take(500))
            .put("project_path", projectPath)
            .put("at", System.currentTimeMillis())
        File(dir, "$id.jsonl").writeText(meta.toString() + "\n")
        prune()
        return id
    }

    fun append(sessionId: String, event: AgentEvent) {
        if (sessionId.isBlank()) return
        ensureDir()
        val file = File(dir, "$sessionId.jsonl")
        if (!file.isFile) return
        // 单会话日志封顶，避免一个忘记结束的长任务把手机存储写满。
        if (file.length() >= MAX_SESSION_BYTES) return
        file.appendText(AgentEventCodec.encode(event) + "\n")
    }

    fun read(sessionId: String): List<AgentEvent> {
        val file = File(dir, "$sessionId.jsonl")
        if (!file.isFile) return emptyList()
        return file.useLines { lines ->
            lines.drop(1)
                .take(MAX_REPLAY_EVENTS)
                .mapNotNull { line ->
                    if (line.isBlank()) null else AgentEventCodec.decode(line)
                }
                .toList()
        }
    }

    fun list(limit: Int = 20): List<AgentSessionMeta> {
        ensureDir()
        val files = dir.listFiles { file -> file.isFile && file.extension == "jsonl" } ?: return emptyList()
        return files.mapNotNull { file -> metaOf(file) }
            .sortedByDescending { it.lastAt }
            .take(limit.coerceAtLeast(1))
    }

    fun latest(): Pair<AgentSessionMeta, List<AgentEvent>>? {
        val meta = list(1).firstOrNull() ?: return null
        return meta to read(meta.id)
    }

    fun delete(sessionId: String): Boolean = File(dir, "$sessionId.jsonl").delete()

    /**
     * 只流式读一遍 JSONL：首行取 meta，其余行累计事件数并找结束标记。
     * 旧实现 useLines { it.toList() } 会把单份 16MB 日志整份读进内存，
     * 20 份历史会话同时列出来时就是数百 MB；这里保持 O(1) 内存。
     */
    private fun metaOf(file: File): AgentSessionMeta? {
        var json: JSONObject? = null
        var eventCount = 0
        var finished = false
        runCatching {
            file.useLines { lines ->
                val it = lines.iterator()
                if (!it.hasNext()) return@useLines
                val head = it.next()
                val parsed = runCatching { JSONObject(head) }.getOrNull() ?: return@useLines
                if (parsed.optString("type") != "session_meta") return@useLines
                json = parsed
                while (it.hasNext()) {
                    val line = it.next()
                    eventCount++
                    if (line.contains("\"type\":\"session_finished\"") ||
                        line.contains("\"type\":\"failure\"")) finished = true
                }
            }
        }.getOrNull() ?: return null
        val meta = json ?: return null
        return AgentSessionMeta(
            id = meta.optString("id"),
            task = meta.optString("task"),
            projectPath = meta.optString("project_path"),
            startedAt = meta.optLong("at"),
            lastAt = file.lastModified(),
            eventCount = eventCount,
            finished = finished,
        )
    }

    private fun prune(keep: Int = 30, maxTotalBytes: Long = 128L * 1024 * 1024) {
        val files = dir.listFiles { file -> file.isFile && file.extension == "jsonl" }
            ?.sortedByDescending { it.lastModified() }
            ?: return
        files.drop(keep).forEach { it.delete() }
        val kept = files.take(keep)
        var total = kept.sumOf { it.length() }
        // 即使份数没超，总占用也要设上限；从最旧的会话开始删。
        kept.asReversed().forEach { file ->
            if (total <= maxTotalBytes) return@forEach
            total -= file.length()
            file.delete()
        }
    }

    private fun ensureDir() {
        if (!dir.isDirectory) dir.mkdirs()
    }

    private companion object {
        const val MAX_SESSION_BYTES = 16L * 1024 * 1024
        const val MAX_REPLAY_EVENTS = 2000
    }
}
