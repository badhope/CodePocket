package com.devterminal.model

import java.io.File

/**
 * llama.cpp JNI 的薄封装。native 库里静态链接了 llama/ggml，
 * APK 只需要一个 libllama_jni.so，避免多个 .so 之间的版本错位。
 */
object LocalLlama {

    private var loaded = false
    private var backendReady = false

    fun isAvailable(): Boolean = runCatching {
        System.loadLibrary("llama_jni")
        true
    }.getOrDefault(false)

    fun load(model: File, contextSize: Int, threads: Int): Boolean {
        if (!model.isFile) return false
        if (!backendReady) {
            backendReady = runCatching { nativeInit() }.getOrDefault(false)
        }
        if (!backendReady) return false
        val ok = runCatching {
            nativeLoadModel(model.absolutePath, contextSize, threads)
        }.getOrDefault(false)
        loaded = ok
        return ok
    }

    fun generate(system: String, user: String, maxTokens: Int): String {
        if (!loaded) return "本地模型尚未加载"
        return runCatching { nativeGenerate(system, user, maxTokens) }
            .getOrElse { "本地推理失败：${it.message}" }
    }

    fun free() {
        if (loaded) runCatching { nativeFree() }
        loaded = false
    }

    fun info(): String = runCatching { nativeInfo() }.getOrDefault("llama.cpp 未加载")

    private external fun nativeInit(): Boolean

    private external fun nativeLoadModel(path: String, contextSize: Int, threads: Int): Boolean

    private external fun nativeGenerate(system: String, user: String, maxTokens: Int): String

    private external fun nativeFree()

    private external fun nativeInfo(): String
}
