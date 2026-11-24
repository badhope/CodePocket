package com.devterminal.engine

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.isActive

/**
 * AI 助手客户端：OpenAI 兼容协议（/chat/completions）。
 *
 * ## 定位说明（重要）
 * AI 是**可选的在线服务**，不属于「离线能力」——它与原生 CPython 离线运行 Python 是两回事。
 * 用户需在设置里自行填写端点地址与 API Key（BYOK），可用云端服务，
 * 也可指向自己部署的 OpenAI 兼容端点（llama.cpp server / LM Studio / Ollama 等）。
 *
 * 端点策略：
 * - `aiBaseUrl` 完全由用户配置，形如 `https://<host>/v1`
 * - 默认值指向本机 Ollama（`http://127.0.0.1:11434/v1`），仅作占位示例——
 *   手机上通常没有本地推理服务，**不配置就等于不可用**，不会静默失败
 * - 未配置端点时 App 不发起任何网络请求，其余功能完全离线
 * - 明文 http 仅放行本机回环（见 res/xml/network_security_config.xml）；
 *   用户自填的局域网 http 地址会被系统拦截，需改用 https 或本机 127.0.0.1
 */
class AiClient(private val settings: com.devterminal.settings.AppSettings) {

    /** 一轮对话消息 */
    data class ChatMessage(val role: String, val content: String)

    /**
     * 发送对话请求。
     * @param system 系统提示词
     * @param history 历史消息（不含本轮）
     * @return 助手回复文本
     * @throws java.io.IOException 网络/端点错误时抛出，message 为可读说明
     */
    fun chat(system: String, history: List<ChatMessage>, userMessage: String): String {
        return chatMessages(
            system = system,
            messages = history + ChatMessage("user", userMessage),
            maxTokens = 1200,
        )
    }

    /**
     * 非流式、显式消息列表调用。Agent 循环需要把工具观察结果作为后续消息
     * 追加进上下文，而不是每次只带一个 userMessage。
     */
    fun chatMessages(
        system: String,
        messages: List<ChatMessage>,
        maxTokens: Int = 2000,
    ): String {
        val base = settings.aiBaseUrl.trimEnd('/')
        val url = URL("$base/chat/completions")

        val payloadMessages = JSONArray()
        payloadMessages.put(JSONObject().put("role", "system").put("content", system))
        messages.forEach { m ->
            payloadMessages.put(JSONObject().put("role", m.role).put("content", m.content))
        }

        val body = JSONObject()
            .put("model", settings.aiModel.ifBlank { "qwen2.5-coder:3b" })
            .put("messages", payloadMessages)
            .put("temperature", 0.2)
            .put("max_tokens", maxTokens.coerceIn(256, 4096))
            .toString()

        return request(url, body)
    }

    private fun request(url: URL, body: String): String {
        var attempt = 1
        while (true) {
            val conn = url.openConnection() as HttpURLConnection
            try {
                conn.requestMethod = "POST"
                conn.connectTimeout = TimeUnit.SECONDS.toMillis(8).toInt()
                conn.readTimeout = TimeUnit.SECONDS.toMillis(90).toInt()
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                if (settings.aiApiKey.isNotBlank()) {
                    conn.setRequestProperty("Authorization", "Bearer ${settings.aiApiKey}")
                }
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

                val code = conn.responseCode
                val reader: BufferedReader = if (code in 200..299)
                    BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8))
                else
                    BufferedReader(InputStreamReader(conn.errorStream ?: conn.inputStream, Charsets.UTF_8))
                val resp = reader.use { readCapped(it) }

                if (code !in 200..299) {
                    if (isRetryable(code) && attempt < MAX_ATTEMPTS) {
                        sleepBeforeRetry(attempt, conn.getHeaderField("Retry-After"))
                        attempt++
                        continue
                    }
                    throw java.io.IOException(friendlyHttp(code, resp))
                }
                return parseChoices(resp)
            } finally {
                conn.disconnect()
            }
        }
    }

    private fun isRetryable(code: Int): Boolean = code == 429 || code in 500..599

    private fun sleepBeforeRetry(attempt: Int, retryAfter: String?) {
        val fromHeader = retryAfter?.trim()?.toLongOrNull()?.let { it * 1000L }
        val delay = fromHeader ?: (attempt * 800L)
        Thread.sleep(delay.coerceIn(400L, 4000L))
    }

    /**
     * 流式对话（SSE）。返回一个冷 Flow，逐段吐出模型生成的增量文本。
     *
     * 约定：
     * - connect 超时 8s；read 空闲超时 120s；外层再套 180s 总超时，避免模型卡死时永久等待。
     * - 每收到一个 `data: {...}` 帧，提取 `choices[0].delta.content` 并 emit。
     * - 收到 `data: [DONE]` 正常结束；HTTP 错误或解析失败以异常形式终结 Flow。
     *
     * UI 层用法：`client.chatStream(...).collect { delta -> 追加到输出 }`，
     * 在 ViewModel 作用域内启动，离开页面时取消即停止请求。
     */
    fun chatStream(
        system: String,
        history: List<ChatMessage>,
        userMessage: String
    ): Flow<String> = callbackFlow {
        val base = settings.aiBaseUrl.trimEnd('/')
        val url = URL("$base/chat/completions")

        val messages = JSONArray()
        messages.put(JSONObject().put("role", "system").put("content", system))
        history.forEach { m ->
            messages.put(JSONObject().put("role", m.role).put("content", m.content))
        }
        messages.put(JSONObject().put("role", "user").put("content", userMessage))

        val body = JSONObject()
            .put("model", settings.aiModel.ifBlank { "qwen2.5-coder:3b" })
            .put("messages", messages)
            .put("temperature", 0.3)
            .put("max_tokens", 1200)
            .put("stream", true)
            .toString()

        var conn: HttpURLConnection? = null
        val worker = Thread {
            try {
                var attempt = 1
                var code: Int
                var err = ""
                while (true) {
                    conn = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = TimeUnit.SECONDS.toMillis(8).toInt()
                        readTimeout = TimeUnit.SECONDS.toMillis(120).toInt()
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("Accept", "text/event-stream")
                        if (settings.aiApiKey.isNotBlank()) {
                            setRequestProperty("Authorization", "Bearer ${settings.aiApiKey}")
                        }
                    }
                    conn!!.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                    code = conn!!.responseCode
                    if (code in 200..299) break
                    err = conn!!.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    if (isRetryable(code) && attempt < MAX_ATTEMPTS) {
                        val retryAfter = conn!!.getHeaderField("Retry-After")
                        conn!!.disconnect()
                        sleepBeforeRetry(attempt, retryAfter)
                        attempt++
                        continue
                    }
                    close(java.io.IOException(friendlyHttp(code, err)))
                    return@Thread
                }

                val reader = BufferedReader(InputStreamReader(conn!!.inputStream, Charsets.UTF_8))
                reader.use { r ->
                    while (isActive) {
                        val line = r.readLine() ?: break
                        if (line.isBlank() || !line.startsWith("data:")) continue
                        val payload = line.removePrefix("data:").trim()
                        if (payload == "[DONE]") break
                        runCatching {
                            val delta = JSONObject(payload)
                                .getJSONArray("choices").getJSONObject(0)
                                .getJSONObject("delta").optString("content", "")
                            if (delta.isNotEmpty()) trySend(delta)
                        }
                    }
                }
                close()
            } catch (e: Exception) {
                close(e)
            }
        }
        worker.start()
        awaitClose {
            worker.interrupt()
            conn?.disconnect()
        }
    }

    /** 限制单次响应体积；BYOK 端点异常返回超大内容时不能把手机内存打爆。 */
    private fun readCapped(reader: BufferedReader, maxChars: Int = 2_000_000): String {
        val sb = StringBuilder()
        val buffer = CharArray(8192)
        while (true) {
            val n = reader.read(buffer)
            if (n < 0) break
            if (sb.length + n > maxChars) {
                sb.append(buffer, 0, (maxChars - sb.length).coerceAtLeast(0))
                break
            }
            sb.append(buffer, 0, n)
        }
        return sb.toString()
    }

    private fun parseChoices(raw: String): String = runCatching {
        val json = JSONObject(raw)
        json.getJSONArray("choices").getJSONObject(0)
            .getJSONObject("message").getString("content").trim()
    }.getOrElse { "AI 返回格式无法解析（确认端点是 OpenAI 兼容协议）：${raw.take(200)}" }

    private fun friendlyHttp(code: Int, body: String): String = when (code) {
        401, 403 -> "鉴权失败（401/403）：检查 API Key"
        404 -> "端点不存在（404）：URL 应以 /v1 结尾，且服务已启动"
        408, 504 -> "AI 响应超时：模型太大或服务忙，试试更小的模型"
        else -> "AI 服务返回 $code：${body.take(160)}"
    }

    companion object {
        private const val MAX_ATTEMPTS = 3

        /** 内置系统提示词：明确告知运行环境与回答风格 */
        const val SYSTEM_PROMPT =
            "你是 CodePocket 的编程助手。用户在安卓手机上的离线 IDE 里写 Python / JavaScript / Lua。" +
            "另有 Java/Kotlin/TypeScript 等编辑级语言。回答要求：中文、简洁、直接给结论和代码，" +
            "代码用 Markdown 代码块标注语言，避免冗长解释。"

        /** 从报错输出中提取要发给 AI 的错误上下文（截断防 token 爆炸） */
        fun errorContext(output: List<String>): String {
            val errLines = output.filter {
                it.startsWith("[err]") || it.contains("Error") || it.contains("Exception")
            }
            val tail = output.takeLast(25).joinToString("\n")
            val chosen = if (errLines.isNotEmpty())
                (errLines.take(10) + "\n--- 完整输出尾部 ---\n" + tail).joinToString("\n")
            else tail
            return chosen.take(3000)
        }
    }
}
