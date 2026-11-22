package com.devterminal.agent.mcp

import com.devterminal.agent.tools.McpTool
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetAddress
import java.net.ServerSocket
import kotlin.concurrent.thread

class McpClientTest {

    /** 四请求的 MCP mock：initialize / initialized / tools.list / tools.call。 */
    private fun startMock(): Pair<ServerSocket, Int> {
        val server = ServerSocket(0, 5, InetAddress.getByName("127.0.0.1"))
        thread(isDaemon = true) {
            runCatching {
                repeat(4) {
                    server.accept().use { socket ->
                        socket.soTimeout = 5000
                        val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
                        var contentLength = 0
                        while (true) {
                            val line = reader.readLine() ?: break
                            if (line.isBlank()) break
                            if (line.startsWith("Content-Length:", ignoreCase = true)) {
                                contentLength = line.substringAfter(':').trim().toIntOrNull() ?: 0
                            }
                        }
                        val body = ByteArray(contentLength)
                        var offset = 0
                        while (offset < contentLength) {
                            val n = reader.read()
                            if (n < 0) break
                            body[offset++] = n.toByte()
                        }
                        val json = runCatching { JSONObject(String(body)) }.getOrDefault(JSONObject())
                        val method = json.optString("method")
                        val out = socket.getOutputStream()
                        when (method) {
                            "notifications/initialized" -> {
                                out.write("HTTP/1.1 202 Accepted\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
                            }
                            "initialize" -> {
                                out.write(
                                    ("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n" +
                                        "Mcp-Session-Id: test-session\r\nConnection: close\r\n\r\n" +
                                        """{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-26"}}""").toByteArray()
                                )
                            }
                            "tools/list" -> {
                                out.write(
                                    ("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n" +
                                        """{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"read_repo","description":"读仓库","inputSchema":{"type":"object","properties":{"path":{"type":"string","description":"路径"}}},"annotations":{"readOnlyHint":true}}]}}""").toByteArray()
                                )
                            }
                            "tools/call" -> {
                                out.write(
                                    ("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n" +
                                        """{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"repo ok"}],"isError":false}}""").toByteArray()
                                )
                            }
                            else -> out.write("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
                        }
                        out.flush()
                    }
                }
            }
        }
        return server to server.localPort
    }

    @Test
    fun `lists tools and calls readonly tool`() = runBlocking {
        val (server, port) = startMock()
        try {
            val client = McpClient("http://127.0.0.1:$port/mcp")
            val tools = client.listTools()
            assertEquals(1, tools.size)
            assertEquals("read_repo", tools[0].name)
            assertTrue(tools[0].readOnly)
            val result = client.callTool("read_repo", JSONObject().put("path", "README.md"))
            assertTrue(result.ok)
            assertEquals("repo ok", result.output)
            val tool = McpTool(client, tools[0])
            assertFalse(tool.spec.executesCommand)
        } finally {
            server.close()
        }
    }
}
