package com.devterminal.engine

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.buffer
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.launch
import org.mozilla.javascript.BaseFunction
import org.mozilla.javascript.ClassShutter
import org.mozilla.javascript.Context as RhinoContext
import org.mozilla.javascript.ContextFactory
import org.mozilla.javascript.EvaluatorException
import org.mozilla.javascript.RhinoException
import org.mozilla.javascript.ScriptRuntime
import org.mozilla.javascript.Scriptable
import org.mozilla.javascript.ScriptableObject
import org.mozilla.javascript.Undefined
import java.io.File
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * JavaScript 运行时：Rhino 1.7.15（纯 Java，无 native/16KB）。
 *
 * 取舍：
 * - 解释执行（optimizationLevel = -1），牺牲一点性能换 Android 兼容；
 * - ES6 语言级别，覆盖 let/const、箭头函数、class、Promise 等常用语法；
 * - 不开放 Java 反射（ClassShutter 全拒绝），避免脚本 `System.exit`；
 * - `print` / `console.log` / `input` 由 Kotlin 注入，复用 RunEvent 流。
 */
class JavaScriptEngine : RunEngine {

    override val isEnvironmentReady: Boolean = true

    private val busy = AtomicBoolean(false)
    private val stopRequested = AtomicBoolean(false)
    private val inputQueue = LinkedBlockingQueue<String>()

    @Volatile private var running = false
    @Volatile private var deadlineMs: Long = Long.MAX_VALUE

    private val factory = object : ContextFactory() {
        override fun observeInstructionCount(cx: RhinoContext, instructionCount: Int) {
            if (System.currentTimeMillis() > deadlineMs) {
                throw EvaluatorException("运行超时或已停止")
            }
        }
    }

    override suspend fun prepareEnvironment(onProgress: (Long, Long) -> Unit) {
        onProgress(100L, 100L)
    }

    override fun warmup() = Unit

    override fun run(request: RunRequest, timeoutMs: Long): Flow<RunEvent> = callbackFlow {
        if (!busy.compareAndSet(false, true)) {
            trySend(RunEvent.Failed("已有 JavaScript 程序在运行中，请先停止。"))
            close()
            return@callbackFlow
        }
        val script = File(request.scriptPath)
        if (!script.exists()) {
            busy.set(false)
            trySend(RunEvent.Failed("文件不存在：${request.scriptPath}"))
            close()
            return@callbackFlow
        }

        trySend(RunEvent.Started("js ${script.name}"))
        bindSink { event -> trySend(event) }
        val startedAt = System.currentTimeMillis()
        running = true
        stopRequested.set(false)
        deadlineMs = startedAt + timeoutMs.coerceAtLeast(1_000L)
        inputQueue.clear()

        val job = launch(Dispatchers.IO) {
            var exitCode = 0
            try {
                val cx = factory.enterContext()
                try {
                    cx.optimizationLevel = -1
                    cx.instructionObserverThreshold = 1_000
                    cx.languageVersion = RhinoContext.VERSION_ES6
                    cx.setClassShutter(ClassShutter { false })

                    val scope = cx.initStandardObjects()
                    installGlobals(cx, scope)

                    val source = script.readText(Charsets.UTF_8)
                    cx.evaluateString(scope, source, script.name, 1, null)
                } finally {
                    RhinoContext.exit()
                }
            } catch (e: RhinoException) {
                exitCode = 1
                trySend(RunEvent.Stderr(if (stopRequested.get()) "已停止" else e.details()))
            } catch (e: Throwable) {
                exitCode = 1
                trySend(RunEvent.Stderr(if (stopRequested.get()) "已停止" else (e.message ?: e.javaClass.simpleName)))
            } finally {
                running = false
                busy.set(false)
                trySend(RunEvent.Finished(exitCode, System.currentTimeMillis() - startedAt))
                close()
            }
        }

        awaitClose {
            // 阻塞的 evaluateString 无法被协程取消；由 stop()/超时观察器收尾。
            if (!job.isCompleted) {
                deadlineMs = 0L
                inputQueue.offer(EOF)
            }
        }
    }.buffer(1024).flowOn(Dispatchers.Default)

    override fun stop() {
        stopRequested.set(true)
        deadlineMs = 0L
        inputQueue.offer(EOF)
    }

    override fun writeStdin(line: String): Boolean {
        if (!running) return false
        inputQueue.offer(line.trimEnd('\n', '\r') + "\n")
        return true
    }

    override fun closeStdin() {
        inputQueue.offer(EOF)
    }

    override fun release() {
        busy.set(false)
        running = false
        inputQueue.clear()
    }

    private fun installGlobals(cx: RhinoContext, scope: ScriptableObject) {
        val print = object : BaseFunction() {
            override fun call(
                cx: RhinoContext?, scope: Scriptable?, thisObj: Scriptable?, args: Array<Any?>?
            ): Any? {
                val text = args?.joinToString(" ") { ScriptRuntime.toString(it) }.orEmpty()
                trySend(RunEvent.Stdout(text))
                return Undefined.instance
            }

            override fun getFunctionName(): String = "print"
        }

        val input = object : BaseFunction() {
            override fun call(
                cx: RhinoContext?, scope: Scriptable?, thisObj: Scriptable?, args: Array<Any?>?
            ): Any? {
                val prompt = args?.firstOrNull()?.let { ScriptRuntime.toString(it) }.orEmpty()
                if (prompt.isNotEmpty()) trySend(RunEvent.Stdout(prompt))
                val line = inputQueue.take()
                if (line == EOF) {
                    throw ScriptRuntime.constructError("EOFError", "EOF")
                }
                return line.trimEnd('\n', '\r')
            }

            override fun getFunctionName(): String = "input"
        }

        ScriptableObject.putProperty(scope, "print", print)
        ScriptableObject.putProperty(scope, "input", input)

        val console = cx.newObject(scope, "Object")
        ScriptableObject.putProperty(console, "log", print)
        ScriptableObject.putProperty(console, "error", print)
        ScriptableObject.putProperty(console, "warn", print)
        ScriptableObject.putProperty(scope, "console", console)
    }

    private fun trySend(event: RunEvent) {
        sink?.invoke(event)
    }

    private var sink: ((RunEvent) -> Unit)? = null

    /** 在 run 开始前把 sink 指向当前 callbackFlow 的 trySend */
    private fun bindSink(send: (RunEvent) -> Unit) {
        sink = send
    }

    private companion object {
        const val EOF = "\u0000__CODEPOCKET_EOF__"
    }
}
