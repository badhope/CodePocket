package com.devterminal.agent.tools

import com.devterminal.agent.ProjectPlugin
import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.workspace.Workspace
import org.mozilla.javascript.ClassShutter
import org.mozilla.javascript.Context
import org.mozilla.javascript.ContextFactory
import org.mozilla.javascript.EvaluatorException
import org.mozilla.javascript.Function

/**
 * 项目插件工具：脚本只能在 Rhino 沙箱里执行 `run(input)`，
 * 不能访问 Java 类、文件系统或网络；返回值回给 Agent。
 */
class JsPluginTool(private val plugin: ProjectPlugin, private val runner: JsPluginRunner = JsPluginRunner) : Tool {
    override val spec = ToolSpec(
        name = "plugin_${plugin.id}".take(64),
        description = "项目 JS 插件 ${plugin.title}：${plugin.description}".take(500),
        parameters = mapOf("input" to "传给脚本 run(input) 的字符串"),
        mutatesWorkspace = false,
        executesCommand = true,
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val input = call.arguments["input"].orEmpty()
        return runCatching {
            val output = runner.run(plugin.id, plugin.code, input)
            ToolResult.success(call.id, "插件 ${plugin.id} 返回：\n${output.take(4000)}", output.length > 4000)
        }.getOrElse { e ->
            ToolResult.failure(call.id, "插件 ${plugin.id} 执行失败：${e.message ?: "未知错误"}")
        }
    }
}

object JsPluginRunner {
    private val factory = object : ContextFactory() {
        override fun makeContext(): Context {
            val cx = super.makeContext()
            cx.optimizationLevel = -1
            cx.languageVersion = Context.VERSION_ES6
            cx.setClassShutter(ClassShutter { false })
            cx.setInstructionObserverThreshold(200_000)
            return cx
        }

        override fun observeInstructionCount(cx: Context, instructionCount: Int) {
            if (instructionCount > 200_000) {
                throw EvaluatorException("插件执行超过指令上限")
            }
        }
    }

    fun run(id: String, code: String, input: String): String {
        val cx = factory.enterContext()
        try {
            val scope = cx.initSafeStandardObjects()
            cx.evaluateString(scope, code, "plugin-$id.js", 1, null)
            val function = scope.get("run", scope)
            if (function !is Function) throw IllegalStateException("插件必须定义 function run(input)")
            val result = function.call(cx, scope, scope, arrayOf(input))
            return Context.toString(result)
        } finally {
            Context.exit()
        }
    }
}
