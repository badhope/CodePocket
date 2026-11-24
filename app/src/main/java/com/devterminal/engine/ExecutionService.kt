package com.devterminal.engine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.devterminal.MainActivity
import com.devterminal.R
import java.lang.ref.WeakReference

/**
 * 前台服务：让 App 在后台运行代码时不被 Android 杀掉。
 *
 * 背景：Android 12+ 会杀掉「缓存进程」和占用 CPU 过多的进程，
 * 表现是运行中的脚本突然输出 `[Process completed (signal 9)]`。
 * 把运行期间的状态提升为前台服务 + 常驻通知，是最正规的解法。
 *
 * 注意：仅在**有代码在跑**时启用，跑完即停，避免长期占通知栏。
 */
class ExecutionService : Service() {

    companion object {
        private const val CHANNEL_ID = "devterminal_exec"
        private const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.devterminal.action.START"
        const val ACTION_STOP = "com.devterminal.action.STOP"
        const val EXTRA_TITLE = "title"
        const val EXTRA_TAG = "tag"
        private const val DEFAULT_TAG = "run"

        /** 启动前台服务（幂等，重复调用安全）；tag 用来区分运行/下载，互不误停。 */
        fun start(context: Context, title: String, tag: String = DEFAULT_TAG) {
            val intent = Intent(context, ExecutionService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_TAG, tag)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /** 同进程内直接调用实例；没有实例时才退回 stopService，避免后台 startService 被系统拒绝。 */
        private var instance: WeakReference<ExecutionService>? = null

        /** 停止指定 tag；只有没有其它任务时才真正撤掉通知。 */
        fun stop(context: Context, tag: String = DEFAULT_TAG) {
            val service = instance?.get()
            if (service != null) {
                Handler(Looper.getMainLooper()).post { service.stopTag(tag) }
            } else {
                context.stopService(Intent(context, ExecutionService::class.java))
            }
        }
    }

    private val activeTitles = linkedMapOf<String, String>()
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = WeakReference(this)
        createChannel()
    }

    private fun stopTag(tag: String) {
        activeTitles.remove(tag)
        if (activeTitles.isEmpty()) {
            releaseWakeLock()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        } else {
            activeTitles.values.lastOrNull()?.let {
                startForeground(NOTIFICATION_ID, buildNotification(it))
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> stopTag(intent?.getStringExtra(EXTRA_TAG) ?: "run")
            else -> {
                val tag = intent?.getStringExtra(EXTRA_TAG) ?: "run"
                val title = intent?.getStringExtra(EXTRA_TITLE) ?: "代码运行中"
                activeTitles[tag] = title
                ensureWakeLock()
                startForeground(NOTIFICATION_ID, buildNotification(title))
            }
        }
        // 被系统杀掉后不自动重启，避免用户已退出却常驻通知
        return START_NOT_STICKY
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "代码运行",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "运行代码时保持进程存活"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        activeTitles.clear()
        releaseWakeLock()
        instance = null
        super.onDestroy()
    }

    /** 前台服务只保进程，不保证 CPU 不休眠；长脚本熄屏后仍需要 partial wakelock。 */
    private fun ensureWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(PowerManager::class.java) ?: return
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CodePocket:execution").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseWakeLock() {
        runCatching { wakeLock?.takeIf { it.isHeld }?.release() }
        wakeLock = null
    }

    private fun buildNotification(title: String): Notification {
        val pending = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("CodePocket")
            .setContentText(title)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(pending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
}
