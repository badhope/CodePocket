package com.devterminal.engine

import android.content.Context
import java.io.File

/**
 * 运行环境的目录管理（原生 CPython 3.13.9 / arm64-v8a + x86_64 版）。
 *
 * ## 与旧版的区别
 * 旧版负责把 441MB 的 `assets/usrtar.zip` 解压到 `files/usr`，并模拟 Termux 环境变量
 * 供原生二进制使用。该方案已废弃——工具链不入库、必须联网下载，与「离线」定位矛盾。
 * 现由原生 CPython 3.13.9（arm64-v8a / x86_64）直接执行，性能与 C 扩展支持均完整。
 *
 * 现在 Python 由随 APK 打包的原生 CPython 执行：
 * - libpython3.13.so、libpybridge.so 在 jniLibs/<abi>，由 PackageManager 解压；
 * - Python C 扩展（math.cpython-...so 等）不在 lib 前缀规则内，首启由
 *   NativeEngine 从 APK 抽到 python-stdlib/lib/python3.13/lib-dynload；
 * - 纯 .py 标准库在 assets/python-stdlib.zip，首启解压到 files/python-stdlib
 *   （由 NativeEngine.ensureStdlib 负责，含完整性校验与 site-packages 创建）。
 * 本类只负责用户工作目录布局。
 *
 * ## 目录布局
 * ```
 * files/projects/        ← 用户项目（ProjectManager 使用）
 * files/home/            ← 用户 HOME（导出/临时文件）
 * files/python-stdlib/   ← 解压的纯 Python 标准库（NativeEngine 管理）
 * ```
 */
class EnvironmentInstaller(private val context: Context) {

    val filesDir: File get() = context.filesDir
    val homeDir: File get() = File(filesDir, "home")
    val projectsDir: File get() = File(filesDir, "projects")

    /**
     * 确保工作目录存在。
     * 原生 CPython 运行时随 APK 打包（.so 在 jniLibs，标准库 zip 首启解压），
     * 这里只建用户目录。
     */
    fun ensureDirs() {
        homeDir.mkdirs()
        projectsDir.mkdirs()
    }
}
