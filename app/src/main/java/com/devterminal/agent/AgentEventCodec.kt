package com.devterminal.agent

import org.json.JSONArray
import org.json.JSONObject

/**
 * AgentEvent 的 JSONL 编解码。
 *
 * 只做一件事：把追加式事件写成一行 JSON，再从一行 JSON 还原。
 * 不使用 Kotlin 序列化，避免为 R8/反射再引一套 keep 规则。
 */
object AgentEventCodec {

    fun encode(event: AgentEvent): String = when (event) {
        is AgentEvent.SessionStarted -> base("session_started", event)
            .put("project_path", event.projectPath)
        is AgentEvent.UserMessage -> base("user_message", event)
            .put("text", event.text)
        is AgentEvent.ContextBuilt -> base("context_built", event)
            .put("mapped_files", event.mappedFiles)
            .put("total_files", event.totalFiles)
            .put("chars", event.chars)
            .put("tokens", event.tokens)
        is AgentEvent.Plan -> base("plan", event)
            .put("steps", JSONArray(event.steps))
        is AgentEvent.ToolCall -> base("tool_call", event)
            .put("call_id", event.callId)
            .put("tool", event.tool)
            .put("arguments", JSONObject(event.arguments as Map<*, *>))
        is AgentEvent.ToolResult -> base("tool_result", event)
            .put("call_id", event.callId)
            .put("ok", event.ok)
            .put("output", event.output)
            .put("truncated", event.truncated)
        is AgentEvent.PatchProposed -> base("patch_proposed", event)
            .put("proposal_id", event.proposalId)
            .put("paths", JSONArray(event.paths))
            .put("diff", event.diff)
        is AgentEvent.Approval -> base("approval", event)
            .put("proposal_id", event.proposalId)
            .put("approved", event.approved)
        is AgentEvent.PatchApplied -> base("patch_applied", event)
            .put("proposal_id", event.proposalId)
            .put("paths", JSONArray(event.paths))
        is AgentEvent.Checkpoint -> base("checkpoint", event)
            .put("checkpoint_id", event.checkpointId)
            .put("label", event.label)
        is AgentEvent.RunResult -> base("run_result", event)
            .put("exit_code", event.exitCode)
            .put("output", event.output)
        is AgentEvent.Failure -> base("failure", event)
            .put("message", event.message)
        is AgentEvent.SessionFinished -> base("session_finished", event)
            .put("summary", event.summary)
    }.toString()

    fun decode(line: String): AgentEvent? {
        val json = runCatching { JSONObject(line) }.getOrNull() ?: return null
        val id = json.optString("id", AgentEvent.newEventId())
        val at = json.optLong("at", AgentEvent.now())
        return when (json.optString("type")) {
            "session_started" -> AgentEvent.SessionStarted(
                projectPath = json.optString("project_path"), id = id, at = at,
            )
            "user_message" -> AgentEvent.UserMessage(
                text = json.optString("text"), id = id, at = at,
            )
            "context_built" -> AgentEvent.ContextBuilt(
                mappedFiles = json.optInt("mapped_files"),
                totalFiles = json.optInt("total_files"),
                chars = json.optInt("chars"),
                tokens = json.optInt("tokens"),
                id = id, at = at,
            )
            "plan" -> AgentEvent.Plan(
                steps = json.optJSONArray("steps").toStringList(),
                id = id, at = at,
            )
            "tool_call" -> AgentEvent.ToolCall(
                callId = json.optString("call_id"),
                tool = json.optString("tool"),
                arguments = json.optJSONObject("arguments").toStringMap(),
                id = id, at = at,
            )
            "tool_result" -> AgentEvent.ToolResult(
                callId = json.optString("call_id"),
                ok = json.optBoolean("ok"),
                output = json.optString("output"),
                truncated = json.optBoolean("truncated"),
                id = id, at = at,
            )
            "patch_proposed" -> AgentEvent.PatchProposed(
                proposalId = json.optString("proposal_id"),
                paths = json.optJSONArray("paths").toStringList(),
                diff = json.optString("diff"),
                id = id, at = at,
            )
            "approval" -> AgentEvent.Approval(
                proposalId = json.optString("proposal_id"),
                approved = json.optBoolean("approved"),
                id = id, at = at,
            )
            "patch_applied" -> AgentEvent.PatchApplied(
                proposalId = json.optString("proposal_id"),
                paths = json.optJSONArray("paths").toStringList(),
                id = id, at = at,
            )
            "checkpoint" -> AgentEvent.Checkpoint(
                checkpointId = json.optString("checkpoint_id"),
                label = json.optString("label"),
                id = id, at = at,
            )
            "run_result" -> AgentEvent.RunResult(
                exitCode = json.optInt("exit_code"),
                output = json.optString("output"),
                id = id, at = at,
            )
            "failure" -> AgentEvent.Failure(
                message = json.optString("message"), id = id, at = at,
            )
            "session_finished" -> AgentEvent.SessionFinished(
                summary = json.optString("summary"), id = id, at = at,
            )
            else -> null
        }
    }

    private fun base(type: String, event: AgentEvent): JSONObject = JSONObject()
        .put("type", type)
        .put("id", event.id)
        .put("at", event.at)

    private fun JSONArray?.toStringList(): List<String> {
        if (this == null) return emptyList()
        return (0 until length()).map { optString(it) }
    }

    private fun JSONObject?.toStringMap(): Map<String, String> {
        if (this == null) return emptyMap()
        return keys().asSequence().associateWith { optString(it) }
    }
}
