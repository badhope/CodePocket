package com.devterminal.model

/**
 * 常见 OpenAI 兼容端点的预设。只填端点和模型名，不预置任何密钥；
 * 用户点一下就能把地址/模型带进设置，密钥仍然由用户自己填。
 */
data class ProviderPreset(
    val id: String,
    val label: String,
    val baseUrl: String,
    val model: String,
)

object ProviderPresets {
    val all: List<ProviderPreset> = listOf(
        ProviderPreset("deepseek", "DeepSeek", "https://api.deepseek.com/v1", "deepseek-chat"),
        ProviderPreset(
            "siliconflow", "硅基流动",
            "https://api.siliconflow.cn/v1", "Qwen/Qwen2.5-Coder-7B-Instruct",
        ),
        ProviderPreset(
            "zhipu", "智谱 GLM",
            "https://open.bigmodel.cn/api/paas/v4", "glm-4.5-flash",
        ),
        ProviderPreset("moonshot", "月之暗面", "https://api.moonshot.cn/v1", "moonshot-v1-8k"),
        ProviderPreset("ollama", "本机 Ollama", "http://127.0.0.1:11434/v1", "qwen2.5-coder:3b"),
    )
}
