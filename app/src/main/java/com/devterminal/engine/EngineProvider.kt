package com.devterminal.engine

import android.content.Context
import android.os.Build
import android.util.Log

/**
 * 引擎工厂：使用原生 CPython（NativeEngine，PEP 738 官方支持，3.13.9 arm64-v8a / x86_64）。
 *
 * P1-3：不再 runCatching 吞掉 UnsatisfiedLinkError 后静默回退——
 * 那会把"库损坏/架构不对"伪装成"正常启动"。
 * 这里明确区分两类失败并抛出带文案的异常，由 UI 层展示：
 *  - 架构不支持：设备 ABI 不含 arm64-v8a / x86_64
 *  - 运行时损坏：assets/python-stdlib.zip 缺失或 loadLibrary(pybridge) 失败
 */
object EngineProvider {

    private const val TAG = "EngineProvider"

    fun create(context: Context): RunEngine {
        checkNativeRuntime(context)
        val abi = Build.SUPPORTED_ABIS.firstOrNull { it == "arm64-v8a" || it == "x86_64" } ?: "unknown"
        Log.i(TAG, "使用原生 CPython 3.13.9 ($abi) + Rhino/LuaJ 纯 Java 运行时")
        return NativeEngine(context)
    }

    /**
     * 启动前显式校验原生运行时是否就位。失败抛 [IllegalStateException]，
     * 文案可直接给用户看。
     */
    private fun checkNativeRuntime(context: Context) {
        // 1) 架构：原生运行时只提供 arm64-v8a / x86_64
        val abis = Build.SUPPORTED_ABIS?.toList().orEmpty()
        val nativeAbi = listOf("arm64-v8a", "x86_64").firstOrNull { abi ->
            abis.any { it.equals(abi, ignoreCase = true) }
        }
        if (nativeAbi == null) {
            throw IllegalStateException(
                "当前 CPU 架构不支持原生 Python（仅支持 arm64-v8a / x86_64，当前设备：${abis.joinToString()}）"
            )
        }

        // 2) 标准库 zip 是否随 APK 打包
        val hasStdlib = runCatching {
            context.assets.open("python-stdlib.zip").use { }
        }.isSuccess
        if (!hasStdlib) {
            throw IllegalStateException(
                "原生 Python 运行时不完整：assets/python-stdlib.zip 缺失，请重新安装 APK"
            )
        }

        // 3) JNI 桥能否加载（触发 NativeBridge 静态 init → System.loadLibrary）
        try {
            Class.forName("com.devterminal.engine.NativeBridge")
        } catch (e: UnsatisfiedLinkError) {
            Log.e(TAG, "loadLibrary(pybridge) 失败", e)
            throw IllegalStateException(
                "原生 Python 运行时加载失败（库可能损坏或与设备不兼容）：${e.message}", e
            )
        } catch (e: Exception) {
            Log.e(TAG, "NativeBridge 初始化失败", e)
            throw IllegalStateException("原生 Python 初始化失败：${e.message}", e)
        }
    }
}
