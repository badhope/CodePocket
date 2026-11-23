package com.devterminal.agent.mcp

import com.devterminal.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * 极简 MCP Streamable HTTP 客户端。
 *
 * 只依赖 HttpURLConnection + org.json，不引额外 SDK；支持 JSON 响应和
 * `text/event-stream` 的 data 行。协议只做 Agent 需要的最小闭环：
 * initialize → notifications/initialized → tools/list → tools/call。
 */
class McpClient(private val endpoint: String) {

    private var nextId = 1
    private var sessionId: String? = null
    private var initialized = false

    suspend fun listTools(): List<McpToolDefinition> = withContext(Dispatchers.IO) {
        ensureInitialized()
        val response = postRpc("tools/list", JSONObject(), expectResponse = true)
        parseTools(response)
    }

    suspend fun listResources(): List<McpResource> = withContext(Dispatchers.IO) {
        ensureInitialized()
        val response = postRpc("resources/list", JSONObject(), expectResponse = true)
        val items = response.optJSONObject("result")?.optJSONArray("resources") ?: JSONArray()
        (0 until minOf(items.length(), MAX_RESOURCES)).mapNotNull { i ->
            val item = items.optJSONObject(i) ?: return@mapNotNull null
            val uri = item.optString("uri").trim()
            if (uri.isEmpty()) return@mapNotNull null
            McpResource(
                uri = uri,
                name = item.optString("name", uri).take(120),
                description = item.optString("description").take(300),
                mimeType = item.optString("mimeType").take(80),
            )
        }
    }

    suspend fun readResource(uri: String): String = withContext(Dispatchers.IO) {
        ensureInitialized()
        val response = postRpc(
            "resources/read",
            JSONObject().put("uri", uri),
            expectResponse = true,
        )
        val result = response.optJSONObject("result")
            ?: throw IllegalStateException("MCP 返回缺少 result")
        val contents = result.optJSONArray("contents") ?: JSONArray()
        buildString {
            for (i in 0 until contents.length()) {
                val item = contents.optJSONObject(i) ?: continue
                item.optString("text").takeIf { it.isNotEmpty() }?.let { append(it) }
                if (item.has("blob")) append("[二进制资源 ${item.optString("mimeType", "unknown")}]")
                append('\n')
            }
        }.trim().ifBlank { "资源为空：$uri" }
    }

    suspend fun listPrompts(): List<McpPrompt> = withContext(Dispatchers.IO) {
        ensureInitialized()
        val response = postRpc("prompts/list", JSONObject(), expectResponse = true)
        val items = response.optJSONObject("result")?.optJSONArray("prompts") ?: JSONArray()
        (0 until minOf(items.length(), MAX_PROMPTS)).mapNotNull { i ->
            val item = items.optJSONObject(i) ?: return@mapNotNull null
            val name = item.optString("name").trim()
            if (name.isEmpty()) return@mapNotNull null
            val args = item.optJSONArray("arguments") ?: JSONArray()
            McpPrompt(
                name = name,
                description = item.optString("description").take(300),
                arguments = (0 until args.length()).mapNotNull { j ->
                    args.optJSONObject(j)?.optString("name")?.takeIf { it.isNotBlank() }
                },
            )
        }
    }

    suspend fun getPrompt(name: String, arguments: JSONObject = JSONObject()): String = withContext(Dispatchers.IO) {
        ensureInitialized()
        val response = postRpc(
            "prompts/get",
            JSONObject().put("name", name).put("arguments", arguments),
            expectResponse = true,
        )
        val result = response.optJSONObject("result")
            ?: throw IllegalStateException("MCP 返回缺少 result")
        val messages = result.optJSONArray("messages") ?: JSONArray()
        buildString {
            for (i in 0 until messages.length()) {
                val message = messages.optJSONObject(i) ?: continue
                val content = message.optJSONObject("content")
                append(message.optString("role", "user")).append("：")
                append(content?.optString("text").orEmpty().ifBlank { "[非文本内容]" })
                append('\n')
            }
        }.trim().ifBlank { "Prompt 为空：$name" }
    }

    private fun ensureInitialized() {
        require(endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
            "MCP 端点必须是 http(s) URL"
        }
        if (initialized) return
        postRpc(
            method = "initialize",
            params = JSONObject()
                .put("protocolVersion", "2025-03-26")
                .put("capabilities", JSONObject())
                .put("clientInfo", JSONObject().put("name", "CodePocket").put("version", BuildConfig.VERSION_NAME)),
            expectResponse = true,
        )
        notify("notifications/initialized", JSONObject())
        initialized = true
    }

    suspend fun callTool(name: String, arguments: JSONObject): McpCallResult = withContext(Dispatchers.IO) {
        ensureInitialized()
        val response = postRpc(
            method = "tools/call",
            params = JSONObject().put("name", name).put("arguments", arguments),
            expectResponse = true,
        )
        val result = response.optJSONObject("result")
            ?: throw IllegalStateException("MCP 返回缺少 result")
        val isError = result.optBoolean("isError", false)
        val text = buildString {
            val content = result.optJSONArray("content")
            if (content != null) {
                for (i in 0 until content.length()) {
                    val item = content.optJSONObject(i) ?: continue
                    when (item.optString("type")) {
                        "text" -> append(item.optString("text"))
                        "image" -> append("[image]")
                        "resource" -> append(item.optString("uri"))
                        else -> append(item.optString("text"))
                    }
                    append('\n')
                }
            }
            result.optJSONObject("structuredContent")?.let {
                if (it.length() > 0) append(it.toString())
            }
        }.trim()
        McpCallResult(ok = !isError, output = text.ifBlank { if (isError) "MCP 工具返回错误" else "MCP 工具执行完成" })
    }

    private fun notify(method: String, params: JSONObject) {
        runCatching {
            postRpc(method, params, expectResponse = false)
        }
    }

    private fun postRpc(method: String, params: JSONObject, expectResponse: Boolean): JSONObject {
        val id = if (expectResponse) nextId++ else null
        val payload = JSONObject()
            .put("jsonrpc", "2.0")
            .put("method", method)
            .put("params", params)
        if (id != null) payload.put("id", id)

        val conn = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json, text/event-stream")
            setRequestProperty("User-Agent", "CodePocket/${BuildConfig.VERSION_NAME}")
            sessionId?.let { setRequestProperty("Mcp-Session-Id", it) }
        }
        try {
            conn.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val headerSession = conn.getHeaderField("Mcp-Session-Id")
            if (!headerSession.isNullOrBlank()) sessionId = headerSession
            val text = (if (code in 200..299) conn.inputStream else conn.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code !in 200..299) throw IllegalStateException("MCP HTTP $code：${text.take(200)}")
            if (!expectResponse || text.isBlank()) return JSONObject()
            val json = decodeBody(text)
            json.optJSONObject("error")?.let {
                throw IllegalStateException("MCP 错误 ${it.optInt("code")}：${it.optString("message")}")
            }
            return json
        } finally {
            conn.disconnect()
        }
    }

    private fun decodeBody(raw: String): JSONObject {
        val text = raw.trim()
        if (text.startsWith("{") || text.startsWith("[")) return JSONObject(text)
        // Streamable HTTP / SSE：取第一条 data: 后的 JSON。
        val dataLine = text.lineSequence()
            .firstOrNull { it.startsWith("data:") }
            ?.removePrefix("data:")
            ?.trim()
            ?: throw IllegalStateException("MCP 响应不是 JSON 或 SSE data")
        return JSONObject(dataLine)
    }

    private fun parseTools(response: JSONObject): List<McpToolDefinition> {
        val tools = response.optJSONObject("result")?.optJSONArray("tools") ?: JSONArray()
        return (0 until minOf(tools.length(), MAX_TOOLS)).mapNotNull { i ->
            val item = tools.optJSONObject(i) ?: return@mapNotNull null
            val name = item.optString("name").trim()
            if (name.isEmpty()) return@mapNotNull null
            val schema = item.optJSONObject("inputSchema") ?: JSONObject()
            val properties = schema.optJSONObject("properties") ?: JSONObject()
            val params = buildMap {
                properties.keys().forEach { key ->
                    val prop = properties.optJSONObject(key) ?: JSONObject()
                    put(key, prop.optString("description", prop.optString("type", "值")))
                }
            }
            val annotations = item.optJSONObject("annotations")
            McpToolDefinition(
                name = name,
                description = item.optString("description").take(300),
                parameters = params,
                schema = schema,
                readOnly = annotations?.optBoolean("readOnlyHint", false) ?: false,
            )
        }
    }

    companion object {
        private const val MAX_TOOLS = 20
        private const val MAX_RESOURCES = 20
        private const val MAX_PROMPTS = 20
    }
}

data class McpToolDefinition(
    val name: String,
    val description: String,
    val parameters: Map<String, String>,
    val schema: JSONObject,
    val readOnly: Boolean,
)

data class McpCallResult(val ok: Boolean, val output: String)

data class McpResource(
    val uri: String,
    val name: String,
    val description: String,
    val mimeType: String,
)

data class McpPrompt(
    val name: String,
    val description: String,
    val arguments: List<String>,
)
