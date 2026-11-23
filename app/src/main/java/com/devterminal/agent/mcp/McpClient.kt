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

    suspend fun listTools(): List<McpToolDefinition> = withContext(Dispatchers.IO) {
        require(endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
            "MCP 端点必须是 http(s) URL"
        }
        postRpc(
            method = "initialize",
            params = JSONObject()
                .put("protocolVersion", "2025-03-26")
                .put("capabilities", JSONObject())
                .put("clientInfo", JSONObject().put("name", "CodePocket").put("version", BuildConfig.VERSION_NAME)),
            expectResponse = true,
        )
        notify("notifications/initialized", JSONObject())
        val response = postRpc("tools/list", JSONObject(), expectResponse = true)
        parseTools(response)
    }

    suspend fun callTool(name: String, arguments: JSONObject): McpCallResult = withContext(Dispatchers.IO) {
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
