package com.devterminal.model

import com.devterminal.settings.AppSettings

/**
 * Agent Provider 的唯一选择入口：云端 BYOK 或本地 GGUF。
 * UI 只关心「可用 / 不可用 + 原因」，不再自己散落判断模型文件、开关和配置。
 */
sealed interface AgentProviderChoice {
    data class Ready(
        val provider: ModelProvider,
        val localProvider: LocalLlamaProvider? = null,
        val usesLocal: Boolean = false,
    ) : AgentProviderChoice

    data class Unavailable(val reason: String) : AgentProviderChoice
}

class ProviderRegistry(private val repository: ModelRepository) {

    fun resolve(settings: AppSettings): AgentProviderChoice {
        if (settings.useLocalModel) {
            val spec = ModelCatalog.byId(settings.localModelId)
                ?: return AgentProviderChoice.Unavailable("本地模型配置不存在，请在「本地模型」重新选择")
            if (!repository.isInstalled(spec)) {
                return AgentProviderChoice.Unavailable("本地模型未下载或校验失败，先到「本地模型」下载")
            }
            val provider = LocalLlamaProvider(repository.modelFile(spec), spec)
            return AgentProviderChoice.Ready(provider, provider, usesLocal = true)
        }
        if (!settings.aiConfigured) {
            return AgentProviderChoice.Unavailable("请先在设置里配置 AI 端点，或下载本地模型")
        }
        return AgentProviderChoice.Ready(OpenAiCompatibleProvider(settings))
    }
}
