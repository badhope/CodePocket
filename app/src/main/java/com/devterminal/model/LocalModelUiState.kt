package com.devterminal.model

data class LocalModelUiState(
    val spec: LocalModelSpec,
    val installed: Boolean,
    val downloading: Boolean = false,
    val progress: Float = -1f,
    val verifying: Boolean = false,
    val error: String? = null,
)
