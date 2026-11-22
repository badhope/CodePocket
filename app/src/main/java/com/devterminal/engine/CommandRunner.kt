package com.devterminal.engine

/** Agent 工具的受限执行结果，只回传尾部输出，避免把整段日志塞给模型。 */
data class CommandResult(
    val ok: Boolean,
    val exitCode: Int,
    val output: String,
    val timedOut: Boolean = false,
)

/** 由 Android 侧实现，Agent 工具只依赖这个接口，单测可替换成 fake。 */
interface CommandRunner {
    suspend fun runFile(path: String, args: List<String> = emptyList(), timeoutMs: Long = 30_000L): CommandResult
    suspend fun runTests(pattern: String? = null, timeoutMs: Long = 30_000L): CommandResult
}
