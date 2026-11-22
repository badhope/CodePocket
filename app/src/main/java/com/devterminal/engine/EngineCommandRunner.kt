package com.devterminal.engine

import android.content.Context
import com.devterminal.settings.AppSettings
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.withTimeout
import java.io.File

/**
 * 把现有 RunEngine 包装成 Agent 可调用的受限命令。
 *
 * 这不是通用 shell：只能跑项目内的可运行文件，Python 测试只跑 unittest discover。
 * 输出只回传尾部，避免长日志撑爆模型上下文。
 */
class EngineCommandRunner(
    private val context: Context,
    private val runtimes: RuntimeRegistry,
    private val projectDir: File,
) : CommandRunner {

    override suspend fun runFile(
        path: String,
        args: List<String>,
        timeoutMs: Long,
    ): CommandResult {
        val file = File(path).let { if (it.isAbsolute) it else File(projectDir, path) }.canonicalFile
        val root = projectDir.canonicalFile
        if (file.path != root.path && !file.path.startsWith(root.path + File.separator)) {
            return CommandResult(false, -1, "拒绝执行项目外的文件：$path")
        }
        if (!file.isFile) return CommandResult(false, -1, "文件不存在：$path")

        val spec = LanguageRegistry.forFile(file)
        if (!spec.isRunnable) {
            return CommandResult(false, -1, "${spec.displayName} 仅支持编辑，不能运行")
        }
        val engine = runtimes.engineFor(spec.id)
            ?: return CommandResult(false, -1, "${spec.displayName} 运行时未接入")

        return execute(engine, file, spec, args, timeoutMs, "Agent 正在运行 ${file.name}")
    }

    override suspend fun runTests(pattern: String?, timeoutMs: Long): CommandResult {
        val script = File(context.cacheDir, "codepocket_unittest_runner.py")
        val root = projectDir.canonicalFile.absolutePath
        val safeRoot = root.replace("\\", "\\\\").replace("\"", "\\\"")
        val safePattern = (pattern?.takeIf { it.isNotBlank() } ?: "test*.py")
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")

        script.writeText(
            """
            import sys, unittest
            project = r"$safeRoot"
            sys.path.insert(0, project)
            loader = unittest.TestLoader()
            suite = loader.discover(start_dir=project, pattern="$safePattern")
            result = unittest.TextTestRunner(verbosity=2).run(suite)
            sys.exit(0 if result.wasSuccessful() else 1)
            """.trimIndent()
        )

        val spec = LanguageRegistry.PYTHON
        val engine = runtimes.engineFor(spec.id)
            ?: return CommandResult(false, -1, "Python 运行时未接入")
        return try {
            execute(engine, script, spec, emptyList(), timeoutMs, "Agent 正在运行 unittest")
        } finally {
            script.delete()
        }
    }

    private suspend fun execute(
        engine: RunEngine,
        file: File,
        spec: LanguageSpec,
        args: List<String>,
        timeoutMs: Long,
        serviceTitle: String,
    ): CommandResult {
        val lines = ArrayList<String>(256)
        var exitCode = -1
        var timedOut = false
        var failure: String? = null
        val effectiveTimeout = timeoutMs.coerceIn(5_000L, 60_000L)

        runCatching { ExecutionService.start(context, serviceTitle) }
        try {
            withTimeout(effectiveTimeout) {
                engine.run(
                    RunRequest(
                        scriptPath = file.absolutePath,
                        workingDir = projectDir.absolutePath,
                        languageId = spec.id,
                        args = args,
                    ),
                    timeoutMs = effectiveTimeout,
                ).collect { event ->
                    when (event) {
                        is RunEvent.Started -> lines += "[执行] ${event.command}"
                        is RunEvent.Stdout -> lines += event.line
                        is RunEvent.Stderr -> lines += "[err] ${event.line}"
                        is RunEvent.Log -> lines += "[引擎] ${event.message}"
                        is RunEvent.Finished -> exitCode = event.exitCode
                        is RunEvent.Failed -> {
                            exitCode = -1
                            failure = event.message
                            lines += "[启动失败] ${event.message}"
                        }
                        else -> Unit
                    }
                }
            }
        } catch (e: TimeoutCancellationException) {
            timedOut = true
            runCatching { engine.stop() }
            lines += "[超时] 运行超过 ${effectiveTimeout / 1000}s，已请求停止"
        } catch (e: Exception) {
            failure = e.message ?: e::class.simpleName
            lines += "[执行异常] ${failure}"
        } finally {
            runCatching { ExecutionService.stop(context) }
        }

        val tail = lines.takeLast(220).joinToString("\n").take(6000)
        val ok = !timedOut && failure == null && exitCode == 0
        return CommandResult(
            ok = ok,
            exitCode = exitCode,
            output = if (tail.isBlank()) "（无输出）" else tail,
            timedOut = timedOut,
        )
    }
}
