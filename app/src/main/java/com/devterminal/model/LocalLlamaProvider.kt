package com.devterminal.model

import com.devterminal.agent.ToolSpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** 可替换的推理后端，单测不需要加载真实 .so。 */
interface LlamaEngine {
    fun load(model: File, contextSize: Int, threads: Int): Boolean
    fun generate(system: String, user: String, maxTokens: Int): String
    fun free()
}

object NativeLlamaEngine : LlamaEngine {
    override fun load(model: File, contextSize: Int, threads: Int): Boolean =
        LocalLlama.load(model, contextSize, threads)

    override fun generate(system: String, user: String, maxTokens: Int): String =
        LocalLlama.generate(system, user, maxTokens)

    override fun free() = LocalLlama.free()
}

class LocalLlamaProvider(
    private val modelFile: File,
    private val spec: LocalModelSpec,
    private val engine: LlamaEngine = NativeLlamaEngine,
) : ModelProvider {
    override val id: String = "local-llama"
    override val label: String = "本地 ${spec.displayName}"
    override val maxOutputTokens: Int = 768

    private var loaded = false

    override suspend fun complete(
        systemPrompt: String,
        messages: List<ModelMessage>,
        tools: List<ToolSpec>,
        maxTokens: Int,
    ): String = withContext(Dispatchers.IO) {
        if (!loaded) {
            if (!engine.load(modelFile, spec.contextSize, spec.threads)) {
                throw IllegalStateException("本地模型加载失败：${modelFile.name}")
            }
            loaded = true
        }
        val system = AgentProtocol.systemPrompt(systemPrompt, tools)
        val user = buildString {
            append("以下是当前对话与工具观察，请继续完成任务：\n\n")
            messages.forEach { message ->
                append(
                    when (message.role) {
                        "assistant" -> "助手："
                        "user" -> "用户："
                        "system" -> "系统："
                        else -> "${message.role}："
                    }
                )
                append(message.content.take(4000)).append("\n\n")
            }
            append("请只输出一个 JSON 对象。")
        }
        engine.generate(system, user, maxTokens)
    }

    fun close() {
        if (loaded) engine.free()
        loaded = false
    }
}
