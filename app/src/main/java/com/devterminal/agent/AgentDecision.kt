package com.devterminal.agent

import org.json.JSONObject

sealed interface AgentDecision {
    data class ToolCall(
        val tool: String,
        val arguments: Map<String, String>,
    ) : AgentDecision

    data class Final(val answer: String) : AgentDecision

    data class Invalid(val reason: String, val raw: String) : AgentDecision
}

interface AgentDecisionParser {
    fun parse(raw: String): AgentDecision
}

/**
 * 文本 JSON 协议解析器。
 *
 * 不依赖 OpenAI 原生 tools 字段，任何 OpenAI 兼容端点都能用；
 * 小模型即使不擅长 function call，也能按这个最小 JSON 协议工作。
 */
class JsonAgentDecisionParser : AgentDecisionParser {
    override fun parse(raw: String): AgentDecision {
        val candidate = extractJsonObject(raw)
            ?: return AgentDecision.Invalid("没有找到 JSON 对象", raw.take(500))
        val json = runCatching { JSONObject(candidate) }
            .getOrElse { e -> return AgentDecision.Invalid("JSON 解析失败：${e.message}", raw.take(500)) }

        val action = json.optString("action", "").trim().lowercase()
        val tool = json.optString("tool", "").trim()
        val answer = json.optString("answer", "").trim()

        return when {
            action == "final" || (action.isEmpty() && answer.isNotEmpty()) ->
                if (answer.isEmpty()) AgentDecision.Invalid("final 缺少 answer", raw.take(500))
                else AgentDecision.Final(answer)

            (action == "tool" || action == "call" || action.isEmpty()) && tool.isNotEmpty() -> {
                val args = HashMap<String, String>()
                val arguments = json.optJSONObject("arguments")
                if (arguments != null) {
                    arguments.keys().forEach { key ->
                        args[key] = arguments.opt(key)?.toString() ?: ""
                    }
                }
                AgentDecision.ToolCall(tool, args)
            }

            else -> AgentDecision.Invalid("action/tool 不完整", raw.take(500))
        }
    }

    private fun extractJsonObject(raw: String): String? {
        val cleaned = raw
            .replace("```json", "```")
            .let { text ->
                val start = text.indexOf("```")
                val end = text.lastIndexOf("```")
                if (start in 0 until end) text.substring(start + 3, end).trim() else text
            }
        val first = cleaned.indexOf('{')
        val last = cleaned.lastIndexOf('}')
        if (first < 0 || last <= first) return null
        return cleaned.substring(first, last + 1)
    }
}
