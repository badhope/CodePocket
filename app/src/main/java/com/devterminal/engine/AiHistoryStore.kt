package com.devterminal.engine

import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * AI 助手会话的轻量持久化：应用私有目录下单个 JSON 数组。
 * 只存 role/content，不存端点、密钥或文件正文；最多保留最近 40 条。
 */
class AiHistoryStore(private val file: File) {

    fun load(): List<AiClient.ChatMessage> = runCatching {
        if (!file.exists()) return@runCatching emptyList()
        val array = JSONArray(file.readText())
        (0 until array.length()).mapNotNull { i ->
            val item = array.optJSONObject(i) ?: return@mapNotNull null
            val role = item.optString("role").trim()
            val content = item.optString("content")
            if (role.isBlank() || content.isBlank()) null else AiClient.ChatMessage(role, content)
        }.takeLast(MAX_MESSAGES)
    }.getOrDefault(emptyList())

    fun save(messages: List<AiClient.ChatMessage>) {
        runCatching {
            val array = JSONArray()
            messages.takeLast(MAX_MESSAGES).forEach { m ->
                array.put(JSONObject().put("role", m.role).put("content", m.content))
            }
            file.parentFile?.mkdirs()
            val temp = File(file.parentFile, "${file.name}.tmp")
            temp.writeText(array.toString())
            if (file.exists()) file.delete()
            temp.renameTo(file)
        }
    }

    fun clear() {
        runCatching { if (file.exists()) file.delete() }
    }

    companion object {
        private const val MAX_MESSAGES = 40
    }
}
