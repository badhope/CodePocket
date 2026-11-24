package com.devterminal.engine

/** 一次运行的请求参数（语言只传 id，不把枚举耦合进运行时） */
data class RunRequest(
    val scriptPath: String,
    val workingDir: String,
    val args: List<String> = emptyList(),
    val languageId: String = LanguageRegistry.PYTHON.id,
    /** Python 专用：用标准库 pdb 启动交互式调试，命令走 stdin，输出走 stdout。 */
    val debug: Boolean = false
)

/** 运行过程中流出的事件（用于实时刷新 UI） */
sealed interface RunEvent {
    /** 进程已启动，附带实际执行的命令（便于排查） */
    data class Started(val command: String) : RunEvent
    /** 标准输出的一行 */
    data class Stdout(val line: String) : RunEvent
    /** 标准错误的一行 */
    data class Stderr(val line: String) : RunEvent
    /** 引擎侧静音日志（如首次预热提示），非程序输出，UI 应以灰色小字展示 */
    data class Log(val message: String) : RunEvent
    /** 进程结束 */
    data class Finished(val exitCode: Int, val durationMs: Long) : RunEvent
    /** 运行前发生的错误（例如工具链未安装、文件不存在、编译失败） */
    data class Failed(val message: String) : RunEvent
}

/** 运行最终结果（给非流式场景用） */
data class RunResult(
    val exitCode: Int,
    val stdout: String,
    val stderr: String,
    val durationMs: Long
)
