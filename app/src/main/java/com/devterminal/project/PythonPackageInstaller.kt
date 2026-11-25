package com.devterminal.project

import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.zip.ZipFile

/**
 * 纯 Python 包安装器。
 *
 * 只接受 `.whl` / `.zip`，拒绝任何原生产物（.so/.pyd/.dll/.wasm）。Android 上
 * 真正能做的是“无编译依赖的纯 Python 包”；把原生 wheel 放进来只会在 import 时
 * 报错，所以这里在安装前就拒绝，而不是装完再让用户猜。
 *
 * 安装不是边解压边写 site-packages：先解到临时目录，校验通过后再逐个顶层条目
 * 替换；失败会回滚已替换的目录/文件，避免半个包留在环境里。
 */
class PythonPackageInstaller(
    private val sitePackages: File,
    /** 可注入的重命名实现：测试用它在第二个顶层条目上制造失败，验证回滚。 */
    private val rename: (File, File) -> Boolean = { from, to -> from.renameTo(to) }
) {

    data class InstallResult(
        val ok: Boolean,
        val message: String,
        val packageName: String? = null,
        val version: String? = null
    )

    data class InstalledPackage(val name: String, val version: String)

    fun install(archive: File): InstallResult {
        if (!archive.isFile) return InstallResult(false, "安装包不存在")
        if (archive.length() > 100L * 1024 * 1024) {
            return InstallResult(false, "安装包超过 100MB，请拆分或换更小的纯 Python 包")
        }
        val staging = File(sitePackages, ".staging-${UUID.randomUUID()}").apply { mkdirs() }
        val backup = File(sitePackages, ".backup-${UUID.randomUUID()}").apply { mkdirs() }
        // 放在 try 外，catch 里的回滚才能看到已替换的条目。
        val moved = mutableListOf<Pair<File, File?>>() // new -> old backup
        try {
            val info = extractToStaging(archive, staging)
                ?: return InstallResult(false, "压缩包为空或没有可安装的文件")
            sitePackages.mkdirs()

            // 排序保证替换顺序可预测，回滚日志也能按逆序精确恢复。
            val topLevel = staging.listFiles()?.sortedBy { it.name }.orEmpty()
            for (entry in topLevel) {
                val dest = File(sitePackages, entry.name)
                val old = if (dest.exists()) {
                    val b = File(backup, entry.name)
                    if (!rename(dest, b)) throw IOException("无法备份旧包 ${dest.name}")
                    b
                } else null
                if (!rename(entry, dest)) {
                    // 当前条目还没进 moved，先把它自己的旧版本恢复回去
                    old?.let { rename(it, dest) }
                    throw IOException("无法写入 ${dest.name}")
                }
                moved += dest to old
            }
            return InstallResult(
                true,
                "已安装 ${info.first ?: "纯 Python 包"}${info.second?.let { " $it" }.orEmpty()}",
                info.first,
                info.second
            )
        } catch (e: Exception) {
            // 回滚所有已替换的顶层条目：有旧版本就恢复旧版本，没有旧版本就删除新写入，
            // 不能把“新装的半截包”留在 site-packages 里。
            runCatching {
                for (i in moved.indices.reversed()) {
                    val dest = moved[i].first
                    val old = moved[i].second
                    dest.deleteRecursively()
                    if (old != null) rename(old, dest)
                }
            }
            return InstallResult(false, "安装失败：${e.message}")
        } finally {
            staging.deleteRecursively()
            // 回滚失败时备份目录可能仍有旧包，绝不能把它一起删掉。
            if (backup.listFiles().isNullOrEmpty()) backup.deleteRecursively()
        }
    }

    /** 扫描 site-packages 里的 dist-info / egg-info，返回已安装包名与版本。 */
    fun installed(): List<InstalledPackage> {
        val out = linkedMapOf<String, String>()
        sitePackages.listFiles()?.forEach { entry ->
            if (entry.isDirectory && (entry.name.endsWith(".dist-info") || entry.name.endsWith(".egg-info"))) {
                val meta = File(entry, "METADATA").takeIf { it.isFile }
                    ?: File(entry, "PKG-INFO").takeIf { it.isFile }
                val name = meta?.readLines()?.firstOrNull { it.startsWith("Name:") }
                    ?.substringAfter(':')?.trim()
                    ?: entry.name.substringBeforeLast('.')
                val version = meta?.readLines()?.firstOrNull { it.startsWith("Version:") }
                    ?.substringAfter(':')?.trim().orEmpty()
                out[name] = version
            }
        }
        return out.entries.sortedBy { it.key.lowercase() }
            .map { InstalledPackage(it.key, it.value) }
    }

    private fun extractToStaging(archive: File, staging: File): Pair<String?, String?>? {
        var totalBytes = 0L
        var count = 0
        var name: String? = null
        var version: String? = null
        ZipFile(archive).use { zf ->
            val entries = zf.entries()
            while (entries.hasMoreElements()) {
                val e = entries.nextElement()
                if (e.isDirectory) continue
                count++
                if (count > 5000) throw IOException("条目超过 5000")
                totalBytes += e.size.coerceAtLeast(0)
                if (totalBytes > 100L * 1024 * 1024) throw IOException("解压后超过 100MB")

                val relative = e.name.replace('\\', '/')
                if (relative.startsWith("/") || relative.startsWith("../") ||
                    relative.contains("/../") || relative.contains(":")
                ) throw IOException("非法路径：${e.name}")
                val target = File(staging, relative)
                val root = staging.canonicalFile
                val prefix = root.path + File.separator
                if (target.canonicalFile.path != root.path && !target.canonicalFile.path.startsWith(prefix)) {
                    throw IOException("路径越界：${e.name}")
                }
                val lower = relative.lowercase()
                if (lower.endsWith(".so") || lower.endsWith(".pyd") ||
                    lower.endsWith(".dll") || lower.endsWith(".dylib") ||
                    lower.endsWith(".wasm") || lower.contains("pyodide")
                ) throw IOException("包含原生/浏览器产物，当前运行时无法加载：${e.name}")

                target.parentFile?.mkdirs()
                zf.getInputStream(e).use { input ->
                    target.outputStream().use { output -> input.copyTo(output) }
                }

                if (lower.endsWith("/metadata") || lower == "metadata") {
                    runCatching {
                        val lines = target.readLines()
                        lines.firstOrNull { it.startsWith("Name:") }?.let { name = it.substringAfter(':').trim() }
                        lines.firstOrNull { it.startsWith("Version:") }?.let { version = it.substringAfter(':').trim() }
                    }
                }
            }
        }
        return if (count == 0) null else name to version
    }
}
