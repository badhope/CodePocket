package com.devterminal.agent

import com.devterminal.workspace.Workspace
import java.io.File
import java.io.IOException
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.UUID

/**
 * 内容寻址的检查点存储。
 *
 * 每次快照只把文件内容按 SHA-256 存一份 blob，快照清单记录路径与 hash。
 * 不创建隐藏 Git worktree，也不会污染用户仓库。
 */
class CheckpointStore(
    private val storeDir: File,
    private val workspace: Workspace,
) {
    data class Checkpoint(
        val id: String,
        val label: String,
        val createdAt: Long,
        val files: List<String>,
    )

    private data class Manifest(
        val createdAt: Long,
        val label: String,
        val entries: List<Pair<String, String>>, // path to hash
    )

    private val blobsDir = File(storeDir, "blobs")
    private val snapshotsDir = File(storeDir, "snapshots")

    fun snapshot(label: String, paths: List<String>): Checkpoint {
        require(paths.isNotEmpty()) { "No files to snapshot" }
        val distinct = paths.distinct()
        val createdAt = System.currentTimeMillis()
        val id = "$createdAt-${UUID.randomUUID().toString().take(8)}"
        ensureDirs()

        val body = StringBuilder()
        body.append("M\t").append(createdAt).append('\t').append(encode(label)).append('\n')
        for (path in distinct.sorted()) {
            val file = workspace.resolve(path)
            require(file.isFile) { "Not a file: $path" }
            val bytes = file.readBytes()
            val hash = sha256(bytes)
            val blob = File(blobsDir, hash)
            if (!blob.exists()) writeAtomic(blob, bytes)
            body.append("F\t").append(hash).append('\t').append(encode(path)).append('\n')
        }

        writeAtomic(File(snapshotsDir, "$id.tsv"), body.toString().toByteArray(Charsets.UTF_8))
        return Checkpoint(id, label, createdAt, distinct.sorted())
    }

    fun restore(checkpoint: Checkpoint): Int {
        val manifest = readManifest(checkpoint.id)
        var restored = 0
        for ((path, expectedHash) in manifest.entries) {
            val blob = File(blobsDir, expectedHash)
            if (!blob.isFile) throw IOException("Missing checkpoint blob: $expectedHash")
            val bytes = blob.readBytes()
            val actual = sha256(bytes)
            if (actual != expectedHash) throw IOException("Checkpoint blob is corrupted: $expectedHash")
            workspace.writeBytes(path, bytes)
            restored++
        }
        return restored
    }

    fun list(): List<Checkpoint> {
        ensureDirs()
        return snapshotsDir.listFiles { file -> file.isFile && file.name.endsWith(".tsv") }
            ?.sortedByDescending { it.lastModified() }
            ?.mapNotNull { file ->
                runCatching {
                    val id = file.name.removeSuffix(".tsv")
                    val manifest = readManifest(id)
                    Checkpoint(id, manifest.label, manifest.createdAt, manifest.entries.map { it.first })
                }.getOrNull()
            }
            ?: emptyList()
    }

    fun delete(checkpointId: String) {
        val file = File(snapshotsDir, "$checkpointId.tsv")
        if (!file.delete() && file.exists()) throw IOException("Cannot delete checkpoint: $checkpointId")
    }

    private fun readManifest(id: String): Manifest {
        val file = File(snapshotsDir, "$id.tsv")
        if (!file.isFile) throw IOException("Checkpoint not found: $id")
        val lines = file.readLines()
        var createdAt = 0L
        var label = ""
        val entries = ArrayList<Pair<String, String>>()
        for (line in lines) {
            if (line.isBlank()) continue
            val parts = line.split('\t')
            when (parts.getOrNull(0)) {
                "M" -> {
                    createdAt = parts.getOrNull(1)?.toLongOrNull() ?: 0L
                    label = parts.getOrNull(2)?.let(::decode) ?: ""
                }
                "F" -> {
                    val hash = parts.getOrNull(1) ?: continue
                    val path = parts.getOrNull(2)?.let(::decode) ?: continue
                    if (hash.length == 64 && path.isNotEmpty()) entries += path to hash
                }
            }
        }
        return Manifest(createdAt, label, entries)
    }

    private fun ensureDirs() {
        if (!blobsDir.exists() && !blobsDir.mkdirs()) {
            throw IOException("Cannot create checkpoint blob dir: ${blobsDir.path}")
        }
        if (!snapshotsDir.exists() && !snapshotsDir.mkdirs()) {
            throw IOException("Cannot create checkpoint dir: ${snapshotsDir.path}")
        }
    }

    private fun writeAtomic(target: File, bytes: ByteArray) {
        val temp = File(target.parentFile, ".${target.name}.tmp-${UUID.randomUUID()}")
        try {
            temp.writeBytes(bytes)
            if (!temp.renameTo(target)) {
                target.outputStream().use { it.write(bytes) }
            }
        } finally {
            if (temp.exists()) temp.delete()
        }
    }

    private fun sha256(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return digest.joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }

    private fun encode(value: String): String = URLEncoder.encode(value, "UTF-8")

    private fun decode(value: String): String = URLDecoder.decode(value, "UTF-8")
}
