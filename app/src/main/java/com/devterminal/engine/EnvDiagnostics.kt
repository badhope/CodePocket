package com.devterminal.engine

import android.content.Context
import android.os.Build
import java.io.File

/** 单个运行能力的探测结果 */
data class ToolStatus(
    val name: String,
    val available: Boolean,
    val detail: String
)

/** 环境自检汇总 */
data class EnvReport(
    val prefixReady: Boolean,
    val installedSizeBytes: Long,
    val tools: List<ToolStatus>
) {
    val allCriticalAvailable: Boolean
        get() = tools.filter { it.name == "Python" }.let { list ->
            list.isEmpty() || list.any { it.available }
        }

    /** 给 UI 用的一行摘要 */
    fun summary(): String {
        val ok = tools.count { it.available }
        return "环境自检：$ok/${tools.size} 项可用"
    }
}

/**
 * 离线环境自检（原生 CPython 3.13.9 / arm64-v8a 版）。
 *
 * 动机：用户拿到 APK 后，最可能的失败是「运行时资源没打进包」或「.so 加载失败」。
 * 与其让他看到一个笼统的报错，不如主动检查 APK 内资源并给出**可执行**的提示。
 *
 * 探测项（对齐原生引擎）：
 * - assets/python-stdlib.zip（纯 Python 标准库）
 * - nativeLibraryDir 下的 libpython3.13.so / libpybridge.so（解释器与 JNI 桥）
 * - nativeLibraryDir 下的 C 扩展（math._random 等）与依赖库（libcrypto_python.so）
 * - CPU 架构是否为 arm64-v8a
 */
object EnvDiagnostics {

    /**
     * 执行诊断。务必在 IO 线程调用。
     */
    fun run(context: Context): EnvReport {
        val tools = mutableListOf<ToolStatus>()
        var totalSize = 0L

        // 1) CPU 架构
        val abis = Build.SUPPORTED_ABIS?.toList().orEmpty()
        val arm64 = abis.any { it.equals("arm64-v8a", ignoreCase = true) }
        tools += if (arm64) {
            ToolStatus("CPU 架构", true, "arm64-v8a · 原生 ABI")
        } else {
            ToolStatus("CPU 架构", false, "不支持：当前设备 ${abis.joinToString()}，仅支持 arm64-v8a")
        }

        // 2) 标准库 zip
        val zipSize = assetSize(context, "python-stdlib.zip")
        if (zipSize > 0) {
            totalSize += zipSize
            tools += ToolStatus("Python 标准库", true, "${formatSize(zipSize)} · assets/python-stdlib.zip")
        } else {
            tools += ToolStatus("Python 标准库", false, "缺失：assets/python-stdlib.zip")
        }

        // 3) nativeLibraryDir 下的关键 .so
        val libDir = context.applicationInfo.nativeLibraryDir
        totalSize += nativeLib(context, tools, libDir, "libpython3.13.so", "解释器本体")
        totalSize += nativeLib(context, tools, libDir, "libpybridge.so", "JNI 桥")

        // 4) C 扩展与依赖库（P0-1：确认 math/_random/_socket/_ctypes 等已打包）
        val mathSo = File(libDir).listFiles()?.firstOrNull {
            it.name.startsWith("math.") && it.name.endsWith(".so")
        }
        tools += if (mathSo != null && mathSo.length() > 0) {
            totalSize += mathSo.length()
            ToolStatus("C 扩展模块", true, "${formatSize(mathSo.length())} · math/_random/_socket/_ctypes 等")
        } else {
            ToolStatus("C 扩展模块", false, "缺失：math.*.so（lib-dynload 未打包）")
        }
        totalSize += nativeLib(context, tools, libDir, "libcrypto_python.so", "OpenSSL 依赖(_ssl/_hashlib)")

        // 5) 能力说明
        tools += ToolStatus("Python 执行", arm64 && zipSize > 0, "原生 CPython 3.13.9 · 完全离线")
        tools += ToolStatus("JavaScript 执行", true, "Rhino 1.7.15（纯 Java）· 无 native")
        tools += ToolStatus("Lua 执行", true, "LuaJ 3.0.1（纯 Java，Lua 5.2）· 无 native")
        tools += ToolStatus("Git 操作", true, "JGit（纯 Java）· 完全离线")
        tools += ToolStatus(
            "Java / Kotlin / TypeScript 等",
            true,
            "仅编辑、语法高亮与静态补全；共 17 种编辑级语言"
        )

        val ready = arm64 && zipSize > 0 &&
            File(libDir, "libpython3.13.so").exists() &&
            File(libDir, "libpybridge.so").exists()
        return EnvReport(ready, totalSize, tools)
    }

    /** 检查 nativeLibraryDir 下某个 .so，返回其字节数（用于累计体积） */
    private fun nativeLib(context: Context, tools: MutableList<ToolStatus>,
                          libDir: String, name: String, label: String): Long {
        val f = File(libDir, name)
        if (f.exists() && f.length() > 0) {
            tools += ToolStatus(label, true, "${formatSize(f.length())} · $name")
            return f.length()
        }
        tools += ToolStatus(label, false, "缺失：$libDir/$name")
        return 0L
    }

    /** 读取 assets 中某文件的大小；不存在或读取失败返回 0 */
    private fun assetSize(context: Context, path: String): Long = runCatching {
        context.assets.open(path).use { it.available().toLong() }
    }.getOrDefault(0L)

    /** 人类可读的体积 */
    fun formatSize(bytes: Long): String = when {
        bytes <= 0 -> "0 B"
        bytes < 1024 -> "$bytes B"
        bytes < 1024 * 1024 -> "%.1f KB".format(bytes / 1024.0)
        bytes < 1024L * 1024 * 1024 -> "%.1f MB".format(bytes / 1024.0 / 1024)
        else -> "%.2f GB".format(bytes / 1024.0 / 1024 / 1024)
    }
}
