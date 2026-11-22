package com.devterminal.model

/**
 * 可下载的端侧模型清单。权重不进 APK；这里只记录来源、大小与校验值。
 *
 * 选型注意：MiniCPM5-2B 总参 2.52B，严格说超过 2B，但非嵌入参数 1.98B，
 * 属于“2B 级”选项，只对 8GB+ 设备开放，不在 UI 里宣传为 2B 以下。
 */
data class LocalModelSpec(
    val id: String,
    val displayName: String,
    val fileName: String,
    val sizeBytes: Long,
    val sha256: String,
    val url: String,
    val minRamGb: Int,
    val params: String,
    val quantization: String,
    val licenseName: String,
    val licenseUrl: String,
    val note: String,
    val contextSize: Int = 4096,
    val threads: Int = 4,
)

object ModelCatalog {
    const val DEFAULT_ID = "minicpm5-1b"

    val models: List<LocalModelSpec> = listOf(
        LocalModelSpec(
            id = DEFAULT_ID,
            displayName = "MiniCPM5-1B",
            fileName = "MiniCPM5-1B-Q4_K_M.gguf",
            sizeBytes = 688_065_920L,
            sha256 = "81b64d05a23b17b34c475f42b3e72fbde62d4b92cc34541f7a8031d0752deafa",
            url = "https://modelscope.cn/models/OpenBMB/MiniCPM5-1B-GGUF/resolve/master/MiniCPM5-1B-Q4_K_M.gguf",
            minRamGb = 6,
            params = "1.08B",
            quantization = "Q4_K_M",
            licenseName = "Apache-2.0",
            licenseUrl = "https://www.modelscope.cn/models/OpenBMB/MiniCPM5-1B-GGUF",
            note = "默认档：1B 级里工具调用与代码能力最强，6GB+ 设备推荐。",
        ),
        LocalModelSpec(
            id = "minicpm5-2b",
            displayName = "MiniCPM5-2B",
            fileName = "MiniCPM5-2B-Q4_K_M.gguf",
            sizeBytes = 1_561_318_368L,
            sha256 = "ec2d5801640099e97d8d7e8003ad4d81f336e757811f03a26173dddf386602fd",
            url = "https://modelscope.cn/models/OpenBMB/MiniCPM5-2B-GGUF/resolve/master/MiniCPM5-2B-Q4_K_M.gguf",
            minRamGb = 8,
            params = "2.52B（非嵌入 1.98B）",
            quantization = "Q4_K_M",
            licenseName = "Apache-2.0",
            licenseUrl = "https://www.modelscope.cn/models/OpenBMB/MiniCPM5-2B-GGUF",
            note = "2B 级高性能档；总参超过 2B，仅 8GB+ 设备建议使用。",
        ),
        LocalModelSpec(
            id = "qwen3.5-2b",
            displayName = "Qwen3.5-2B",
            fileName = "Qwen3.5-2B-Q4_K_M.gguf",
            sizeBytes = 1_280_835_840L,
            sha256 = "aaf42c8b7c3cab2bf3d69c355048d4a0ee9973d48f16c731c0520ee914699223",
            url = "https://modelscope.cn/models/unsloth/Qwen3.5-2B-GGUF/resolve/master/Qwen3.5-2B-Q4_K_M.gguf",
            minRamGb = 8,
            params = "1.89B（2B 级）",
            quantization = "Q4_K_M",
            licenseName = "Apache-2.0",
            licenseUrl = "https://www.modelscope.cn/models/Qwen/Qwen3.5-2B",
            note = "备选档：中文稳定、生态成熟；Qwen3.5 官方架构 + unsloth 量化，国内 ModelScope 源。",
        ),
    )

    fun byId(id: String?): LocalModelSpec? = models.firstOrNull { it.id == id }
}
