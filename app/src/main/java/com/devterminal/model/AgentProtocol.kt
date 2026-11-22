package com.devterminal.model

import com.devterminal.agent.ToolSpec

/**
 * Agent 的文本工具协议。云端和本地共用同一份提示词，
 * 避免两个 provider 对 JSON 格式说法不一致，模型一换就崩。
 */
object AgentProtocol {

    fun systemPrompt(base: String, tools: List<ToolSpec>): String {
        val catalog = if (tools.isEmpty()) {
            "（当前没有可用工具）"
        } else {
            tools.joinToString("\n") { spec ->
                val params = spec.parameters.entries.joinToString(", ") { "${it.key}: ${it.value}" }
                "- ${spec.name}($params)：${spec.description}"
            }
        }
        return """$base

可用工具：
$catalog

输出格式二选一：
1) 调用工具：
{"action":"tool","tool":"工具名","arguments":{"参数名":"字符串值"}}
2) 完成任务：
{"action":"final","answer":"给用户的简短结论"}

规则：
- 一次只调用一个工具；拿到工具结果后再决定下一步。
- 修改文件只能用 apply_patch，start/end 是 1-based 闭区间。
- 不确定文件内容时先 read_file 或 search_text，不要猜。
- 最多 8 步；连续失败就输出 final 说明卡在哪里。
- 只输出 JSON，不要输出 Markdown 代码块以外的解释。"""
    }
}
