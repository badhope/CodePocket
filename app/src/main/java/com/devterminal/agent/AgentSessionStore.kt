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
        file.appendText(AgentEventCodec.encode(event) + "\n")
    }

    fun read(sessionId: String): List<AgentEvent> {
        val file = File(dir, "$sessionId.jsonl")
        if (!file.isFile) return emptyList()
        return file.useLines { lines ->
            lines.drop(1).mapNotNull { line ->
                if (line.isBlank()) null else AgentEventCodec.decode(line)
            }.toList()
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

    private fun metaOf(file: File): AgentSessionMeta? {
        val lines = runCatching { file.readLines() }.getOrNull() ?: return null
        val head = lines.firstOrNull() ?: return null
        val json = runCatching { JSONObject(head) }.getOrNull() ?: return null
        if (json.optString("type") != "session_meta") return null
        val finished = lines.drop(1).any {
            it.contains("\"type\":\"session_finished\"") || it.contains("\"type\":\"failure\"")
        }
        return AgentSessionMeta(
            id = json.optString("id"),
            task = json.optString("task"),
            projectPath = json.optString("project_path"),
            startedAt = json.optLong("at"),
            lastAt = file.lastModified(),
            eventCount = (lines.size - 1).coerceAtLeast(0),
            finished = finished,
        )
    }

    private fun prune(keep: Int = 30) {
        val files = dir.listFiles { file -> file.isFile && file.extension == "jsonl" }
            ?.sortedByDescending { it.lastModified() }
            ?: return
        files.drop(keep).forEach { it.delete() }
    }

    private fun ensureDir() {
        if (!dir.isDirectory) dir.mkdirs()
    }
}
