package com.devterminal.agent

import java.util.UUID

/**
 * 追加式 Agent 事件。
 *
 * 每条事件一旦写入会话日志就不再修改；UI 时间线、会话恢复和调试回放
 * 都从事件流派生，避免把状态散落在 ViewModel 里。
 */
sealed interface AgentEvent {
    val id: String
    val at: Long

    data class SessionStarted(
        val projectPath: String,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class UserMessage(
        val text: String,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class ContextBuilt(
        val mappedFiles: Int,
        val totalFiles: Int,
        val chars: Int,
        /** 系统提示词的粗略 token 估算；0 表示旧版会话未记录。 */
        val tokens: Int = 0,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class Plan(
        val steps: List<String>,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class ToolCall(
        val callId: String,
        val tool: String,
        val arguments: Map<String, String> = emptyMap(),
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class ToolResult(
        val callId: String,
        val ok: Boolean,
        val output: String,
        val truncated: Boolean = false,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class PatchProposed(
        val proposalId: String,
        val paths: List<String>,
        val diff: String,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class Approval(
        val proposalId: String,
        val approved: Boolean,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class PatchApplied(
        val proposalId: String,
        val paths: List<String>,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class Checkpoint(
        val checkpointId: String,
        val label: String,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class RunResult(
        val exitCode: Int,
        val output: String,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class Failure(
        val message: String,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    data class SessionFinished(
        val summary: String,
        override val id: String = newEventId(),
        override val at: Long = now(),
    ) : AgentEvent

    companion object {
        fun newEventId(): String = UUID.randomUUID().toString()

        fun now(): Long = System.currentTimeMillis()
    }
}

private fun newEventId(): String = AgentEvent.newEventId()

private fun now(): Long = AgentEvent.now()
