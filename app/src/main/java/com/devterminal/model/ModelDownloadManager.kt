package com.devterminal.model

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

data class ModelDownloadProgress(
    val modelId: String,
    val downloadedBytes: Long,
    val totalBytes: Long,
    val verifying: Boolean = false,
) {
    val fraction: Float
        get() = if (totalBytes > 0) (downloadedBytes.toFloat() / totalBytes).coerceIn(0f, 1f) else -1f
}

/**
 * 支持断点续传的模型下载器。
 *
 * 下载到 `.part`，完成后校验 SHA-256，再原子改名为正式文件。
 * 中途退出/断网会留下 `.part`，下次从已有字节继续，不重下 600MB。
 */
class ModelDownloadManager(private val repository: ModelRepository) {

    suspend fun download(
        spec: LocalModelSpec,
        onProgress: (ModelDownloadProgress) -> Unit = {},
    ): File = withContext(Dispatchers.IO) {
        repository.ensureDir()
        val part = repository.partFile(spec)
        val existing = if (part.isFile) part.length() else 0L
        val free = repository.freeBytes()
        val needed = (spec.sizeBytes - existing).coerceAtLeast(0L)
        if (free in 1..needed) {
            throw IllegalStateException("存储空间不足：还需 ${needed / 1024 / 1024}MB")
        }

        val conn = (URL(spec.url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 60_000
            setRequestProperty("User-Agent", "CodePocket/0.0.19 (Android; llama.cpp)")
            setRequestProperty("Accept-Encoding", "identity")
            if (existing > 0) setRequestProperty("Range", "bytes=$existing-")
        }

        try {
            val code = conn.responseCode
            val append = code == HttpURLConnection.HTTP_PARTIAL
            if (code != HttpURLConnection.HTTP_OK && code != HttpURLConnection.HTTP_PARTIAL) {
                throw IllegalStateException("模型下载失败：HTTP $code")
            }
            val startBytes = if (append) existing else 0L
            if (!append && part.exists()) part.delete()
            val remaining = conn.contentLengthLong.takeIf { it > 0 } ?: (spec.sizeBytes - startBytes)
            val total = (startBytes + remaining).coerceAtLeast(spec.sizeBytes)
            var downloaded = startBytes
            onProgress(ModelDownloadProgress(spec.id, downloaded, total))

            conn.inputStream.use { input ->
                java.io.FileOutputStream(part, append).use { output ->
                    val buffer = ByteArray(256 * 1024)
                    var lastReport = 0L
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                        downloaded += read
                        if (downloaded - lastReport >= 512 * 1024) {
                            lastReport = downloaded
                            onProgress(ModelDownloadProgress(spec.id, downloaded, total))
                        }
                    }
                }
            }
            if (part.length() != spec.sizeBytes) {
                throw IllegalStateException("模型文件不完整：${part.length()}/${spec.sizeBytes}")
            }
            onProgress(ModelDownloadProgress(spec.id, part.length(), spec.sizeBytes, verifying = true))
            val actual = sha256(part)
            if (!actual.equals(spec.sha256, ignoreCase = true)) {
                part.delete()
                throw IllegalStateException("SHA-256 校验失败：文件已删除，请重试")
            }
            val target = repository.modelFile(spec)
            if (target.exists()) target.delete()
            if (!part.renameTo(target)) {
                part.copyTo(target, overwrite = true)
                part.delete()
            }
            repository.writeVerified(spec)
            onProgress(ModelDownloadProgress(spec.id, spec.sizeBytes, spec.sizeBytes))
            target
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw e
        } finally {
            conn.disconnect()
        }
    }

    fun cancelPartial(spec: LocalModelSpec) {
        repository.partFile(spec).delete()
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
