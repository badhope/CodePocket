package com.devterminal.model

import java.io.File

/**
 * 模型文件仓库。下载器、Provider 和设置页都只通过它定位文件，
 * 避免三处各自拼路径导致“下载到了 A、加载的是 B”。
 */
class ModelRepository(val dir: File) {

    fun modelFile(spec: LocalModelSpec): File = File(dir, spec.fileName)

    fun partFile(spec: LocalModelSpec): File = File(dir, "${spec.fileName}.part")

    fun markerFile(spec: LocalModelSpec): File = File(dir, "${spec.fileName}.sha256")

    fun isInstalled(spec: LocalModelSpec): Boolean {
        val file = modelFile(spec)
        if (!file.isFile || file.length() != spec.sizeBytes) return false
        val marker = markerFile(spec)
        if (!marker.isFile) return false
        return runCatching { marker.readText().trim() }.getOrNull() == spec.sha256
    }

    fun installedModels(): List<LocalModelSpec> = ModelCatalog.models.filter { isInstalled(it) }

    fun delete(spec: LocalModelSpec): Boolean {
        val removed = listOf(modelFile(spec), partFile(spec), markerFile(spec))
            .map { if (it.exists()) it.delete() else true }
        return removed.all { it }
    }

    fun ensureDir(): Boolean = dir.isDirectory || dir.mkdirs()

    fun freeBytes(): Long = runCatching { dir.usableSpace }.getOrDefault(0L)

    fun writeVerified(spec: LocalModelSpec) {
        ensureDir()
        markerFile(spec).writeText(spec.sha256)
    }
}
