package com.devterminal.engine

import android.app.Service
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Python 引擎宿主进程。
 *
 * 这个 Service 运行在 `android:process=":engine"` 的独立进程里，主进程永远不加载
 * libpython / libpybridge。这样脚本卡在不可中断的 C 调用时，只要杀掉本进程即可，
 * 编辑器的未保存内容、终端、Git 面板都不受影响。
 *
 * 只通过 Messenger 交换 JSON，主进程拿不到 NativeEngine 实例，也不存在“换个壳
 * 继续同进程”的假隔离。
 */
class EngineHostService : Service() {

    companion object {
        private const val TAG = "EngineHostService"
        const val ACTION_HARD_RESET = "com.devterminal.action.HARD_RESET_ENGINE"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private lateinit var engine: NativeEngine
    private lateinit var messenger: Messenger
    private var runningJob: Job? = null
    private var runningId: Long = 0L

    override fun onCreate() {
        super.onCreate()
        engine = NativeEngine(this)
        messenger = Messenger(Handler(Looper.getMainLooper()) { msg -> handle(msg) })
    }

    override fun onBind(intent: Intent?): IBinder = messenger.binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_HARD_RESET) {
            // 主动请求的硬重启：直接结束本进程，让主进程的绑定断开并重建。
            android.os.Process.killProcess(android.os.Process.myPid())
        }
        return START_NOT_STICKY
    }

    private fun handle(msg: Message): Boolean {
        val id = msg.data?.getLong(EngineRpc.KEY_ID) ?: 0L
        val reply = msg.replyTo
        when (msg.what) {
            EngineRpc.MSG_PREPARE -> {
                if (reply == null) return true
                scope.launch {
                    try {
                        engine.prepareEnvironment { done, total ->
                            send(reply, EngineRpc.MSG_PREPARE_PROGRESS, id,
                                Bundle().apply {
                                    putLong(EngineRpc.KEY_DONE, done)
                                    putLong(EngineRpc.KEY_TOTAL, total)
                                })
                        }
                        send(reply, EngineRpc.MSG_PREPARE_DONE, id)
                        send(reply, EngineRpc.MSG_READY, id)
                    } catch (e: Exception) {
                        Log.e(TAG, "prepare failed", e)
                        send(reply, EngineRpc.MSG_PREPARE_FAILED, id,
                            Bundle().apply { putString(EngineRpc.KEY_MESSAGE, e.message ?: "初始化失败") })
                    }
                }
            }
            EngineRpc.MSG_WARMUP -> engine.warmup()
            EngineRpc.MSG_RUN -> {
                if (reply == null) return true
                val payload = msg.data?.getString(EngineRpc.KEY_PAYLOAD) ?: return true
                val (runId, request, timeoutMs) = runCatching {
                    EngineRpc.decodeRunPayload(payload)
                }.getOrElse {
                    send(reply, EngineRpc.MSG_EVENT, id,
                        Bundle().apply {
                            putString(EngineRpc.KEY_PAYLOAD,
                                EngineRpc.eventPayload(id, RunEvent.Failed("运行参数损坏：${it.message}")))
                        })
                    return true
                }
                if (runningJob?.isActive == true) {
                    send(reply, EngineRpc.MSG_EVENT, runId,
                        Bundle().apply {
                            putString(EngineRpc.KEY_PAYLOAD,
                                EngineRpc.eventPayload(runId, RunEvent.Failed("已有程序在运行中，请先停止。")))
                        })
                    return true
                }
                runningId = runId
                val job = scope.launch {
                    val self = coroutineContext[Job]
                    try {
                        engine.run(request, timeoutMs).collect { event ->
                            send(reply, EngineRpc.MSG_EVENT, runId,
                                Bundle().apply {
                                    putString(EngineRpc.KEY_PAYLOAD, EngineRpc.eventPayload(runId, event))
                                })
                        }
                    } catch (e: kotlinx.coroutines.CancellationException) {
                        // STOP/RELEASE 主动取消，不合成失败事件；Remote 侧会自行收尾。
                        throw e
                    } catch (e: Throwable) {
                        // 引擎事件流异常终止时必须补一条终态，否则主进程的 callbackFlow
                        // 会一直等不到 Finished/Failed，UI 看起来永远在运行。
                        send(reply, EngineRpc.MSG_EVENT, runId,
                            Bundle().apply {
                                putString(EngineRpc.KEY_PAYLOAD,
                                    EngineRpc.eventPayload(runId,
                                        RunEvent.Failed("引擎运行异常：${e.message ?: e.javaClass.simpleName}")))
                            })
                    } finally {
                        // 旧 job 的 finally 不能把刚启动的新 job 状态清掉。
                        if (runningJob === self) {
                            runningJob = null
                            runningId = 0L
                        }
                    }
                }
                runningJob = job
            }
            EngineRpc.MSG_STOP -> {
                // 只停当前 run；如果停止消息来自旧连接，也不能误停新 run。
                if (runningId == id || id == 0L) engine.stop()
            }
            EngineRpc.MSG_STDIN -> {
                val line = msg.data?.getString(EngineRpc.KEY_PAYLOAD) ?: ""
                engine.writeStdin(line)
            }
            EngineRpc.MSG_EOF -> engine.closeStdin()
            EngineRpc.MSG_RELEASE -> {
                runningJob?.cancel()
                runningJob = null
                runCatching { engine.release() }
                stopSelf()
            }
            EngineRpc.MSG_HARD_RESET -> {
                // 不 try/finally：这就是故意让进程死掉。主进程的 ServiceConnection
                // 会收到断开，下一次运行重新 bind 一个干净的引擎进程。
                android.os.Process.killProcess(android.os.Process.myPid())
            }
        }
        return true
    }

    private fun send(reply: Messenger, what: Int, id: Long, data: Bundle? = null) {
        val msg = Message.obtain(null, what).apply {
            this.data = (data ?: Bundle()).apply { putLong(EngineRpc.KEY_ID, id) }
        }
        runCatching { reply.send(msg) }
    }

    override fun onDestroy() {
        runningJob?.cancel()
        runCatching { engine.release() }
        scope.cancel()
        super.onDestroy()
    }
}
