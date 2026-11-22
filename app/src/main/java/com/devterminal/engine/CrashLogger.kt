package com.devterminal.engine

import android.content.Context
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 全局崩溃记录。
 *
 * 动机：这是要在手机上离线使用的工具类 App，用户崩了之后**没法连电脑看 logcat**。
 * 把堆栈写到 App 私有目录，用户可在「关于」页复制出来反馈，排查成本大幅降低。
 *
 * 两个易踩的坑：
 *  1. Activity 每次重建都会走 [install]，若不去重会层层包裹 handler，
 *     同一条崩溃被写 N 份 —— 用 CAS 标记保证只装一次。
 *  2. 反复崩溃会让日志无限膨胀，占满本就紧张的手机存储 —— 回滚截断到 [MAX_BYTES]。
 */
object CrashLogger {

    private const val FILE_NAME = "crash.log"
    /** 日志上限：超出后只保留尾部，避免长期累积吃满存储 */
    private const val MAX_BYTES = 256 * 1024

    private val installed = AtomicBoolean(false)

    fun install(context: Context) {
        if (!installed.compareAndSet(false, true)) return
        val appContext = context.applicationContext
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            runCatching { writeCrash(appContext, thread, throwable) }
            // 交回系统默认处理（走正常崩溃流程），避免吞掉异常
            previous?.uncaughtException(thread, throwable)
        }
    }

    private fun writeCrash(context: Context, thread: Thread, throwable: Throwable) {
        val sw = StringWriter()
        throwable.printStackTrace(PrintWriter(sw))
        val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())
        val entry = buildString {
            append("===== $time =====\n")
            append("Thread: ${thread.name}\n")
            append(sw.toString())
            append("\n\n")
        }
        val file = File(context.filesDir, FILE_NAME)
        val existing = if (file.exists()) runCatching { file.readText() }.getOrDefault("") else ""
        val merged = existing + entry
        // 只保留尾部，保证看到的永远是最新的崩溃
        val kept = if (merged.toByteArray().size > MAX_BYTES) merged.takeLast(MAX_BYTES / 2) else merged
        file.writeText(kept)
    }

    /** 读取已记录的崩溃日志（供「关于」页展示/复制） */
    fun read(context: Context): String {
        val f = File(context.filesDir, FILE_NAME)
        return if (f.exists()) runCatching { f.readText() }.getOrDefault("") else ""
    }

    /** 原生信号崩溃日志（pybridge 的 signal handler 写入，与 Java 崩溃分开） */
    fun readNative(context: Context): String {
        val f = File(context.filesDir, "crash-native.log")
        return if (f.exists()) runCatching { f.readText() }.getOrDefault("") else ""
    }

    /** 关于页统一出口：Java 崩溃 + 原生崩溃都展示，清空时一起清 */
    fun readAll(context: Context): String =
        listOf(read(context), readNative(context)).filter { it.isNotBlank() }.joinToString("\n")

    fun clear(context: Context) {
        runCatching { File(context.filesDir, FILE_NAME).delete() }
        runCatching { File(context.filesDir, "crash-native.log").delete() }
    }
}
