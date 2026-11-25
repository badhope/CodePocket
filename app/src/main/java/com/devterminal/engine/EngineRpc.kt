package com.devterminal.engine

import android.os.Bundle
import org.json.JSONArray
import org.json.JSONObject

/**
 * 主进程与 `:engine` 进程之间的最小协议。
 *
 * 只传 JSON 字符串/基本类型，不传 Parcelable：RunEngine 的接口以后换实现时，
 * 协议层不用跟着改；JVM 单测也能直接覆盖编解码。
 */
object EngineRpc {

    // ---- 客户端 -> 引擎进程 ----
    const val MSG_PREPARE = 1
    const val MSG_WARMUP = 2
    const val MSG_RUN = 3
    const val MSG_STOP = 4
    const val MSG_STDIN = 5
    const val MSG_EOF = 6
    const val MSG_RELEASE = 7
    const val MSG_HARD_RESET = 8

    // ---- 引擎进程 -> 客户端 ----
    const val MSG_EVENT = 101
    const val MSG_PREPARE_PROGRESS = 102
    const val MSG_PREPARE_DONE = 103
    const val MSG_PREPARE_FAILED = 104
    const val MSG_READY = 105

    const val KEY_ID = "id"
    const val KEY_PAYLOAD = "payload"
    const val KEY_DONE = "done"
    const val KEY_TOTAL = "total"
    const val KEY_MESSAGE = "message"

    fun runPayload(id: Long, request: RunRequest, timeoutMs: Long): String =
        JSONObject().apply {
            put("id", id)
            put("timeoutMs", timeoutMs)
            put("scriptPath", request.scriptPath)
            put("workingDir", request.workingDir)
            put("languageId", request.languageId)
            put("debug", request.debug)
            put("args", JSONArray(request.args))
        }.toString()

    fun decodeRunPayload(json: String): Triple<Long, RunRequest, Long> {
        val o = JSONObject(json)
        val args = o.optJSONArray("args")?.let { array ->
            (0 until array.length()).map { array.optString(it, "") }
        } ?: emptyList()
        val request = RunRequest(
            scriptPath = o.getString("scriptPath"),
            workingDir = o.getString("workingDir"),
            args = args,
            languageId = o.optString("languageId", LanguageRegistry.PYTHON.id),
            debug = o.optBoolean("debug", false)
        )
        return Triple(o.getLong("id"), request, o.optLong("timeoutMs", 120_000L))
    }

    fun eventPayload(id: Long, event: RunEvent): String =
        JSONObject().apply {
            put("id", id)
            when (event) {
                is RunEvent.Started -> {
                    put("type", "started"); put("command", event.command)
                }
                is RunEvent.Stdout -> {
                    put("type", "stdout"); put("line", event.line)
                }
                is RunEvent.Stderr -> {
                    put("type", "stderr"); put("line", event.line)
                }
                is RunEvent.Log -> {
                    put("type", "log"); put("message", event.message)
                }
                is RunEvent.Finished -> {
                    put("type", "finished"); put("exitCode", event.exitCode); put("durationMs", event.durationMs)
                }
                is RunEvent.Failed -> {
                    put("type", "failed"); put("message", event.message)
                }
            }
        }.toString()

    fun decodeEventPayload(json: String): Pair<Long, RunEvent>? = runCatching {
        val o = JSONObject(json)
        val id = o.getLong("id")
        val event: RunEvent = when (o.getString("type")) {
            "started" -> RunEvent.Started(o.optString("command", ""))
            "stdout" -> RunEvent.Stdout(o.optString("line", ""))
            "stderr" -> RunEvent.Stderr(o.optString("line", ""))
            "log" -> RunEvent.Log(o.optString("message", ""))
            "finished" -> RunEvent.Finished(o.optInt("exitCode", 0), o.optLong("durationMs", 0L))
            "failed" -> RunEvent.Failed(o.optString("message", "引擎失败"))
            else -> return null
        }
        id to event
    }.getOrNull()

    fun message(what: Int, id: Long = 0L, payload: String? = null): android.os.Message =
        android.os.Message.obtain(null, what).apply {
            data = Bundle().apply {
                putLong(KEY_ID, id)
                if (payload != null) putString(KEY_PAYLOAD, payload)
            }
        }
}
