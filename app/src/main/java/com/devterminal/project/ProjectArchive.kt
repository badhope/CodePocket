package com.devterminal.project

import java.io.BufferedInputStream
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * 项目 zip 导入 / 导出。
 *
 * 迁移项目时最怕两件事：压缩包里带 `../` 把文件写到项目外，或一个几百 MB 的
 * 压缩包解压后把手机存储塞满。这里把两道护栏放在同一层：
 * - 导出跳过 `.git`、构建产物、依赖目录与符号链接，只打源码和项目配置；
 * - 导入限制条目数、单文件大小、总解压大小，并做 canonical path 校验。
 *
 * 归档内路径统一用 `/`，解压后写入应用私有 projects 目录，不触碰 SAF 之外的
 * 用户文件。
 */
object ProjectArchive {

    data class ExportSummary(val files: Int, val bytes: Long)

    /** 导出上限：项目再大也不该在手机上生成一个解压后超过 256MB 的包。 */
    private const val MAX_EXPORT_BYTES = 256L * 1024 * 1024

    /** 导入上限：10,000 个条目、单文件 48MB、总解压 256MB。 */
    private const val MAX_ENTRIES = 10_000
    private const val MAX_ENTRY_BYTES = 48L * 1024 * 1024
    private const val MAX_IMPORT_BYTES = 256L * 1024 * 1024

    /** 不进入压缩包的目录：Git 元数据、构建产物、依赖与缓存。 */
    private val EXCLUDED_DIRS = setOf(
        ".git", "build", "dist", "node_modules", "__pycache__", ".gradle", ".idea"
    )

    fun export(projectDir: File, output: OutputStream): ExportSummary {
        val root = projectDir.canonicalFile
        require(root.isDirectory) { "项目目录不存在：${projectDir.name}" }

        var files = 0
        var bytes = 0L
        ZipOutputStream(output).use { zip ->
            root.walkTopDown()
                .onEnter { dir ->
                    // 符号链接目录不进包，避免把项目外的内容打进来或形成环。
                    dir.name !in EXCLUDED_DIRS &&
                        dir.canonicalFile.absolutePath == dir.absoluteFile.absolutePath
                }
                .filter { it.isFile }
                .forEach { file ->
                    // 单个符号链接文件同样跳过；canonical 与 absolute 不一致即视为链接。
                    if (file.canonicalFile.absolutePath != file.absoluteFile.absolutePath) return@forEach
                    val rel = file.relativeTo(root).invariantSeparatorsPath
                    if (rel.isBlank() || rel.startsWith("../")) return@forEach
                    val length = file.length()
                    if (bytes + length > MAX_EXPORT_BYTES) {
                        throw IllegalArgumentException(
                            "项目过大，导出上限 ${MAX_EXPORT_BYTES / 1024 / 1024}MB；请先清理 build/node_modules"
                        )
                    }
                    val entry = ZipEntry(rel).apply { time = file.lastModified() }
                    zip.putNextEntry(entry)
                    file.inputStream().use { input -> input.copyTo(zip) }
                    zip.closeEntry()
                    files++
                    bytes += length
                }
        }
        return ExportSummary(files, bytes)
    }

    /**
     * 解压到 projectsRoot 下的新项目目录。
     *
     * 若压缩包只有一个顶层目录（常见的 `my-project/...` 结构），直接把该目录作为
     * 项目根，避免出现 `my-project/my-project/...`；否则以项目名创建根目录。
     */
    fun import(input: InputStream, projectsRoot: File, projectName: String?): File {
        projectsRoot.mkdirs()
        val temp = File(projectsRoot, ".import-${UUID.randomUUID()}")
        temp.mkdirs()
        var imported = false
        try {
            var entries = 0
            var totalBytes = 0L
            ZipInputStream(BufferedInputStream(input)).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break
                    entries++
                    if (entries > MAX_ENTRIES) {
                        throw IllegalArgumentException("压缩包条目超过 $MAX_ENTRIES 个，已拒绝导入")
                    }
                    val name = safeEntryName(entry.name)
                    val target = File(temp, name)
                    if (!isInside(temp, target)) {
                        throw IllegalArgumentException("压缩包包含非法路径：${entry.name}")
                    }
                    if (entry.isDirectory) {
                        target.mkdirs()
                    } else {
                        target.parentFile?.mkdirs()
                        var entryBytes = 0L
                        target.outputStream().use { out ->
                            val buffer = ByteArray(8 * 1024)
                            while (true) {
                                val read = zip.read(buffer)
                                if (read <= 0) break
                                entryBytes += read
                                totalBytes += read
                                if (entryBytes > MAX_ENTRY_BYTES) {
                                    throw IllegalArgumentException(
                                        "压缩包内单文件超过 ${MAX_ENTRY_BYTES / 1024 / 1024}MB：$name"
                                    )
                                }
                                if (totalBytes > MAX_IMPORT_BYTES) {
                                    throw IllegalArgumentException(
                                        "压缩包解压后超过 ${MAX_IMPORT_BYTES / 1024 / 1024}MB，已拒绝导入"
                                    )
                                }
                                out.write(buffer, 0, read)
                            }
                        }
                    }
                    zip.closeEntry()
                }
            }
            if (entries == 0) throw IllegalArgumentException("压缩包是空的")
            if (totalBytes == 0L && temp.listFiles().isNullOrEmpty()) {
                throw IllegalArgumentException("压缩包没有可导入的文件")
            }

            // 只有一层顶层目录时，把它提升为项目根；__MACOSX 等系统垃圾不计入。
            val visible = temp.listFiles()
                ?.filterNot { it.name == "__MACOSX" || it.name.startsWith("._") }
                .orEmpty()
            if (visible.isEmpty()) {
                throw IllegalArgumentException("压缩包没有可导入的文件")
            }
            if (visible.size == 1 && visible[0].isDirectory) {
                val dir = visible[0]
                val target = allocateProjectDir(projectsRoot, projectName?.takeIf { it.isNotBlank() } ?: dir.name)
                if (!dir.renameTo(target)) {
                    throw IllegalStateException("无法创建项目目录：${target.name}")
                }
                // 顶层目录已经移出临时目录；清掉空的 .import-* 残留。
                temp.deleteRecursively()
                imported = true
                return target
            }

            val target = allocateProjectDir(projectsRoot, projectName?.takeIf { it.isNotBlank() } ?: "imported")
            if (!temp.renameTo(target)) {
                throw IllegalStateException("无法创建项目目录：${target.name}")
            }
            imported = true
            return target
        } finally {
            if (!imported) temp.deleteRecursively()
        }
    }

    /** 压缩包条目名归一化：拒绝绝对路径、`..`、Windows 盘符和空名。 */
    private fun safeEntryName(raw: String): String {
        val normalized = raw.replace('\\', '/').trim()
        val parts = normalized.split('/').filter { it.isNotEmpty() }
        require(parts.isNotEmpty()) { "压缩包包含空路径" }
        require(parts.none { it == "." || it == ".." }) { "压缩包包含非法路径：$raw" }
        require(parts.none { it.contains(':') }) { "压缩包包含非法路径：$raw" }
        return parts.joinToString("/")
    }

    /** target 必须真的落在 root 之下，防止 `..` 或绝对路径逃逸。 */
    private fun isInside(root: File, target: File): Boolean {
        val rootPath = root.canonicalFile.absolutePath + File.separator
        return target.canonicalFile.absolutePath.startsWith(rootPath)
    }

    private fun allocateProjectDir(root: File, name: String): File {
        val base = sanitizeFileName(name)
        var dir = File(root, base)
        var suffix = 1
        while (dir.exists()) {
            dir = File(root, "$base-${suffix++}")
        }
        return dir
    }
}
