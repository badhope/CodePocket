package com.devterminal.engine

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference

/**
 * 主进程侧的引擎代理。
 *
 * 它不持有任何 NativeEngine / NativeBridge 引用；所有 Python 调用都在
 * `:engine` 进程里。进程死掉时，这里只看到 ServiceConnection 断开，
 * 重新 bind 就能得到一个新的解释器，不会连累主进程。
 */
class RemoteNativeEngine(private val appContext: Context) : RunEngine {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val ready = AtomicBoolean(false)
    private val busy = AtomicBoolean(false)
    private val nextId = AtomicLong(1L)
    private val currentRunId = AtomicLong(0L)

    /** requestId -> 消息处理；run / prepare 各注册一个，结束即移除 */
    private val listeners = ConcurrentHashMap<Long, (Message) -> Unit>()

    private val lock = Any()

    @Volatile
    private var connection: Connection? = null

    override val isEnvironmentReady: Boolean get() = ready.get()
    override val isBusy: Boolean get() = busy.get()

    // ==================== 连接 ====================

    private inner class Connection : ServiceConnection {
        private val messenger = CompletableDeferred<Messenger>()
        private val inboundHandler = Handler(Looper.getMainLooper()) { msg ->
            dispatch(msg)
            true
        }
        val replyMessenger = Messenger(inboundHandler)
        @Volatile private var dead = false
        @Volatile private var bound = false

        init {
            val intent = Intent(appContext, EngineHostService::class.java)
                .setComponent(ComponentName(appContext, EngineHostService::class.java))
            val ok = runCatching {
                appContext.bindService(
                    intent,
                    this,
                    Context.BIND_AUTO_CREATE or Context.BIND_IMPORTANT
                )
            }.getOrDefault(false)
            bound = ok
            if (!ok) messenger.completeExceptionally(IllegalStateException("无法绑定 Python 引擎进程"))
        }

        suspend fun await(): Messenger = withTimeout(8_000L) { messenger.await() }

        fun send(what: Int, id: Long = 0L, payload: String? = null): Boolean {
            if (dead) return false
            val svc = runCatching { messenger.getCompleted() }.getOrNull() ?: return false
            val msg = Message.obtain(null, what).apply {
                data = Bundle().apply {
                    putLong(EngineRpc.KEY_ID, id)
                    if (payload != null) putString(EngineRpc.KEY_PAYLOAD, payload)
                }
                replyTo = replyMessenger
            }
            return runCatching { svc.send(msg) }.isSuccess
        }

        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            if (dead) return
            if (service == null) {
                messenger.completeExceptionally(IllegalStateException("引擎进程返回空 Binder"))
                return
            }
            messenger.complete(Messenger(service))
        }

        override fun onServiceDisconnected(name: ComponentName?) = markDead("引擎进程已断开")

        override fun onBindingDied(name: ComponentName?) = markDead("引擎进程已退出")

        override fun onNullBinding(name: ComponentName?) =
            markDead("引擎进程没有返回 Binder")

        fun markDead(reason: String) {
            if (dead) return
            dead = true
            if (!messenger.isCompleted) {
                messenger.completeExceptionally(IllegalStateException(reason))
            }
            onEngineGone(this, reason)
        }

        fun unbind() {
            dead = true
            if (bound) {
                runCatching { appContext.unbindService(this) }
                bound = false
            }
        }
    }

    private suspend fun ensureConnection(): Connection {
        val c = synchronized(lock) {
            val old = connection
            if (old != null && old.send(EngineRpc.MSG_WARMUP, 0L)) old
            else {
                old?.unbind()
                Connection().also { connection = it }
            }
        }
        c.await()
        return c
    }

    // ==================== RunEngine ====================

    override suspend fun prepareEnvironment(onProgress: (Long, Long) -> Unit) {
        val c = ensureConnection()
        val id = nextId.getAndIncrement()
        val done = CompletableDeferred<Unit>()
        listeners[id] = { msg ->
            when (msg.what) {
                EngineRpc.MSG_PREPARE_PROGRESS -> {
                    val data = msg.data
                    onProgress(
                        data?.getLong(EngineRpc.KEY_DONE) ?: 0L,
                        data?.getLong(EngineRpc.KEY_TOTAL) ?: 0L
                    )
                }
                EngineRpc.MSG_PREPARE_DONE, EngineRpc.MSG_READY -> {
                    ready.set(true)
                    if (!done.isCompleted) done.complete(Unit)
                    listeners.remove(id)
                }
                EngineRpc.MSG_PREPARE_FAILED -> {
                    val message = msg.data?.getString(EngineRpc.KEY_MESSAGE) ?: "Python 引擎初始化失败"
                    if (!done.isCompleted) done.completeExceptionally(IllegalStateException(message))
                    listeners.remove(id)
                }
                EngineRpc.MSG_EVENT -> {
                    // 引擎进程在 prepare 期间死亡时，onEngineGone 会合成一条 Failed 事件；
                    // 这里必须消费它，否则只能干等 120 秒超时。
                    val payload = msg.data?.getString(EngineRpc.KEY_PAYLOAD)
                    val pair = payload?.let(EngineRpc::decodeEventPayload)
                    val failed = pair?.second as? RunEvent.Failed
                    if (pair != null && pair.first == id && failed != null) {
                        if (!done.isCompleted) {
                            done.completeExceptionally(IllegalStateException(failed.message))
                        }
                        listeners.remove(id)
                    }
                }
            }
        }
        if (!c.send(EngineRpc.MSG_PREPARE, id)) {
            listeners.remove(id)
            throw IllegalStateException("无法向 Python 引擎进程发送初始化请求")
        }
        try {
            withTimeout(120_000L) { done.await() }
        } finally {
            // 超时也必须摘掉监听器，否则后续事件会写进一个没人等待的 id。
            listeners.remove(id)
        }
    }

    override fun warmup() {
        scope.launch {
            runCatching {
                val c = ensureConnection()
                c.send(EngineRpc.MSG_WARMUP)
            }
        }
    }

    override fun stop() {
        connection?.send(EngineRpc.MSG_STOP, currentRunId.get())
    }

    override fun writeStdin(line: String): Boolean {
        val c = connection ?: return false
        return c.send(EngineRpc.MSG_STDIN, payload = line)
    }

    override fun closeStdin() {
        connection?.send(EngineRpc.MSG_EOF)
    }

    override fun run(request: RunRequest, timeoutMs: Long): Flow<RunEvent> = callbackFlow {
        val id = nextId.getAndIncrement()
        val c = try {
            ensureConnection()
        } catch (e: Exception) {
            trySend(RunEvent.Failed("Python 引擎进程不可用：${e.message}"))
            close()
            return@callbackFlow
        }
        if (busy.getAndSet(true)) {
            trySend(RunEvent.Failed("已有程序在运行中，请先停止。"))
            busy.set(false)
            close()
            return@callbackFlow
        }
        currentRunId.set(id)
        val finished = AtomicBoolean(false)

        fun emit(event: RunEvent) {
            trySend(event)
            if (event is RunEvent.Finished || event is RunEvent.Failed) {
                finished.set(true)
                busy.set(false)
                currentRunId.compareAndSet(id, 0L)
                listeners.remove(id)
                close()
            }
        }

        listeners[id] = { msg ->
            if (msg.what == EngineRpc.MSG_EVENT) {
                val payload = msg.data?.getString(EngineRpc.KEY_PAYLOAD)
                if (payload != null) {
                    val pair = EngineRpc.decodeEventPayload(payload)
                    if (pair != null && pair.first == id) emit(pair.second)
                }
            }
        }
        if (!c.send(EngineRpc.MSG_RUN, id, EngineRpc.runPayload(id, request, timeoutMs))) {
            emit(RunEvent.Failed("无法向 Python 引擎进程发送运行请求"))
        }

        awaitClose {
            listeners.remove(id)
            // UI 主动取消（例如退出页面）时，不能把引擎留在后台跑。
            if (!finished.get()) {
                c.send(EngineRpc.MSG_STOP, id)
                busy.set(false)
                currentRunId.compareAndSet(id, 0L)
            }
        }
    }

    override suspend fun hardReset() {
        ready.set(false)
        busy.set(false)
        val c = synchronized(lock) {
            connection.also { connection = null }
        }
        c?.send(EngineRpc.MSG_HARD_RESET)
        // 给 Binder 一点时间把“杀进程”消息送到，再解绑；服务进程会自杀。
        delay(150L)
        c?.unbind()
        failListeners("Python 引擎已重启")
    }

    override fun release() {
        ready.set(false)
        busy.set(false)
        val c = synchronized(lock) {
            connection.also { connection = null }
        }
        c?.send(EngineRpc.MSG_RELEASE)
        c?.unbind()
        failListeners("Python 引擎已释放")
        scope.cancel()
    }

    // ==================== 回调 ====================

    private fun dispatch(msg: Message) {
        when (msg.what) {
            EngineRpc.MSG_EVENT, EngineRpc.MSG_PREPARE_PROGRESS,
            EngineRpc.MSG_PREPARE_DONE, EngineRpc.MSG_PREPARE_FAILED -> {
                val id = msg.data?.getLong(EngineRpc.KEY_ID) ?: 0L
                listeners[id]?.invoke(msg)
            }
            EngineRpc.MSG_READY -> ready.set(true)
        }
    }

    private fun onEngineGone(source: Connection, reason: String) {
        ready.set(false)
        busy.set(false)
        synchronized(lock) {
            if (connection === source) connection = null
        }
        failListeners(reason)
    }

    private fun failListeners(reason: String) {
        val ids = listeners.keys.toList()
        ids.forEach { id ->
            val msg = Message.obtain(null, EngineRpc.MSG_EVENT).apply {
                data = Bundle().apply {
                    putLong(EngineRpc.KEY_ID, id)
                    putString(
                        EngineRpc.KEY_PAYLOAD,
                        EngineRpc.eventPayload(id, RunEvent.Failed(reason))
                    )
                }
            }
            listeners[id]?.invoke(msg)
        }
        listeners.clear()
    }
}
