package com.devterminal.model

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.InetAddress
import java.net.ServerSocket
import java.security.MessageDigest
import kotlin.concurrent.thread

class ModelDownloadManagerTest {
    @get:Rule
    val temp = TemporaryFolder()

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    /** 起一个只服务一次的极简 HTTP 服务器，支持 Range，避免测试依赖 JDK 内置服务器模块。 */
    private fun serveOnce(payload: ByteArray, supportRange: Boolean): Pair<ServerSocket, Int> {
        val server = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
        thread(isDaemon = true) {
            runCatching {
                server.accept().use { socket ->
                    val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
                    var rangeStart: Int? = null
                    while (true) {
                        val line = reader.readLine() ?: break
                        if (line.isBlank()) break
                        if (line.startsWith("Range:", ignoreCase = true)) {
                            rangeStart = line.substringAfter("bytes=").substringBefore("-").toIntOrNull()
                        }
                    }
                    val start = if (supportRange) (rangeStart ?: 0).coerceIn(0, payload.size) else 0
                    val body = payload.copyOfRange(start, payload.size)
                    val out = socket.getOutputStream()
                    if (start > 0) {
                        out.write(
                            ("HTTP/1.1 206 Partial Content\r\n" +
                                "Content-Type: application/octet-stream\r\n" +
                                "Content-Length: ${body.size}\r\n" +
                                "Content-Range: bytes $start-${payload.size - 1}/${payload.size}\r\n" +
                                "Connection: close\r\n\r\n").toByteArray()
                        )
                    } else {
                        out.write(
                            ("HTTP/1.1 200 OK\r\n" +
                                "Content-Type: application/octet-stream\r\n" +
                                "Content-Length: ${body.size}\r\n" +
                                "Connection: close\r\n\r\n").toByteArray()
                        )
                    }
                    out.write(body)
                    out.flush()
                }
            }
        }
        return server to server.localPort
    }

    @Test
    fun `downloads and resumes with range`() = runBlocking {
        val payload = ByteArray(256) { (it % 251).toByte() }
        val (server, port) = serveOnce(payload, supportRange = true)
        try {
            val dir = temp.newFolder("models")
            val repo = ModelRepository(dir)
            val spec = LocalModelSpec(
                id = "test", displayName = "Test", fileName = "test.gguf",
                sizeBytes = payload.size.toLong(), sha256 = sha256(payload),
                url = "http://127.0.0.1:$port/model.gguf",
                minRamGb = 6, params = "tiny", quantization = "none",
                licenseName = "MIT", licenseUrl = "https://example.com", note = "test",
            )
            File(dir, "test.gguf.part").writeBytes(payload.copyOfRange(0, 100))
            val downloaded = ModelDownloadManager(repo).download(spec)
            assertArrayEquals(payload, downloaded.readBytes())
            assertTrue(repo.isInstalled(spec))
        } finally {
            server.close()
        }
    }


    @Test
    fun `complete part verifies without network`() = runBlocking {
        val payload = ByteArray(64) { (it + 1).toByte() }
        val dir = temp.newFolder("models")
        val repo = ModelRepository(dir)
        val spec = LocalModelSpec(
            id = "test", displayName = "Test", fileName = "test.gguf",
            sizeBytes = payload.size.toLong(), sha256 = sha256(payload),
            url = "http://127.0.0.1:1/never",
            minRamGb = 6, params = "tiny", quantization = "none",
            licenseName = "MIT", licenseUrl = "https://example.com", note = "test",
        )
        File(dir, "test.gguf.part").writeBytes(payload)
        val downloaded = ModelDownloadManager(repo).download(spec)
        assertArrayEquals(payload, downloaded.readBytes())
        assertTrue(repo.isInstalled(spec))
    }

    @Test
    fun `sha mismatch deletes part`() = runBlocking {
        val payload = ByteArray(32) { 7 }
        val (server, port) = serveOnce(payload, supportRange = false)
        try {
            val dir = temp.newFolder("models")
            val repo = ModelRepository(dir)
            val spec = LocalModelSpec(
                id = "test", displayName = "Test", fileName = "test.gguf",
                sizeBytes = payload.size.toLong(), sha256 = "0".repeat(64),
                url = "http://127.0.0.1:$port/model.gguf",
                minRamGb = 6, params = "tiny", quantization = "none",
                licenseName = "MIT", licenseUrl = "https://example.com", note = "test",
            )
            runCatching { ModelDownloadManager(repo).download(spec) }
            assertTrue(!File(dir, "test.gguf.part").exists())
            assertTrue(!File(dir, "test.gguf").exists())
        } finally {
            server.close()
        }
    }
}
