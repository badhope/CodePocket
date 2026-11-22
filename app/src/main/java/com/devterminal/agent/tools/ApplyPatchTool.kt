package com.devterminal.agent.tools

import com.devterminal.agent.Tool
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolResult
import com.devterminal.agent.ToolSpec
import com.devterminal.workspace.Workspace

/**
 * 按行区间替换。模型只需要给 1-based 的 start/end 和替换文本，
 * 比要求它生成统一 diff 更稳，尤其适合手机小模型。
 */
class ApplyPatchTool : Tool {
    override val spec = ToolSpec(
        name = "apply_patch",
        description = "按行区间替换文件内容。start/end 均为 1-based 闭区间；end 可等于 start-1 表示插入。",
        parameters = mapOf(
            "path" to "相对项目根目录的文件路径",
            "start" to "起始行，1-based",
            "end" to "结束行，1-based；插入时设为 start-1",
            "replacement" to "替换文本，可包含换行；为空表示删除该区间",
        ),
        mutatesWorkspace = true,
    )

    override suspend fun execute(call: ToolCall, workspace: Workspace): ToolResult {
        val path = call.arguments["path"]?.trim()
            ?: return ToolResult.failure(call.id, "apply_patch 缺少 path")
        val start = call.arguments["start"]?.toIntOrNull()
            ?: return ToolResult.failure(call.id, "apply_patch 缺少 start")
        val end = call.arguments["end"]?.toIntOrNull()
            ?: return ToolResult.failure(call.id, "apply_patch 缺少 end")
        val replacement = call.arguments["replacement"] ?: ""

        val window = runCatching { workspace.replaceLines(path, start, end, replacement) }
            .getOrElse { e -> return ToolResult.failure(call.id, "补丁失败：${e.message}") }

        val output = "已修改 $path\n${window.numbered()}"
        return ToolResult.success(
            callId = call.id,
            output = output.take(MAX_OUTPUT_CHARS),
            truncated = output.length > MAX_OUTPUT_CHARS || window.truncated,
        )
    }

    companion object {
        private const val MAX_OUTPUT_CHARS = 5000
    }
}
