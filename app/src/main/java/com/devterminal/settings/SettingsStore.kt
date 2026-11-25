package com.devterminal.settings

import android.content.Context
import android.content.SharedPreferences
import android.content.res.Configuration
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * 主题模式（三态）：跟随系统 / 浅色 / 深色。
 * 存字符串而非枚举，避免新增模式时破坏 SharedPreferences 里的旧值。
 */
object ThemeModes {
    const val SYSTEM = "system"
    const val LIGHT = "light"
    const val DARK = "dark"

    /** 设置页展示顺序 */
    val ALL = listOf(SYSTEM, LIGHT, DARK)

    /** 模式的展示名（设置页三态选择器用） */
    fun label(mode: String): String = when (mode) {
        SYSTEM -> "跟随系统"
        LIGHT -> "浅色"
        else -> "深色"
    }
}

/** 用户可配置项 */
data class AppSettings(
    /** 主题模式：ThemeModes.SYSTEM / LIGHT / DARK，默认深色（与旧版 darkTheme=true 一致） */
    val themeMode: String = ThemeModes.DARK,
    val editorFontSize: Int = 14,
    /** 切换文件时是否自动保存当前改动 */
    val autoSave: Boolean = true,
    /** 单次运行超时（秒），防止死循环把手机拖死 */
    val timeoutSeconds: Int = 120,
    /** 输出面板高度（dp），可拖拽调整，重启保留 */
    val outputHeightDp: Int = 260,
    /**
     * 编辑器配色主题（TextMate 主题名）。
     * "auto" = 跟随 App 明暗（深色用 darcula、浅色用 quiet-light），其余为固定主题。
     */
    val editorTheme: String = "auto",
    /** 编辑器自动换行（长行折到下一行） */
    val wordWrap: Boolean = false,
    /** 输入括号/引号时自动补全闭合符号 */
    val autoCloseBrackets: Boolean = true,
    /** 编辑器左侧显示行号 */
    val showLineNumbers: Boolean = true,
    // ---------- AI 助手（可选，BYOK） ----------
    /**
     * AI 端点（OpenAI 兼容，形如 `https://<host>/v1`），由用户自行配置（BYOK）。
     * 默认值指向本机 Ollama 仅作占位示例——手机上一般没有本地推理服务，
     * 不填就用不了。AI 属于可选的在线服务，与「离线执行 Python」无关。
     */
    val aiBaseUrl: String = DEFAULT_AI_BASE_URL,
    /** 敏感：API Key，存加密 SharedPreferences */
    val aiApiKey: String = "",
    val aiModel: String = DEFAULT_AI_MODEL,
    /**
     * 用户是否在设置页显式保存过 AI 配置。
     *
     * 不能靠「端点非空」来判断：默认值是占位示例（本机 Ollama），恒非空，
     * 否则「未配置」引导永远不出现，用户一点 AI 动作就直接发请求然后必然失败。
     */
    val aiConfigured: Boolean = false,
    // ---------- 本地模型 ----------
    /** true 时 Agent 优先使用已下载的本地 GGUF，不再发网络请求。 */
    val useLocalModel: Boolean = false,
    val localModelId: String = "minicpm5-1b",
    // ---------- 生态扩展 ----------
    /** MCP Streamable HTTP 端点；为空表示未配置。 */
    val mcpEnabled: Boolean = false,
    val mcpEndpoint: String = "",
    /** 项目 `.codepocket/plugins` 的 JS 工具，默认关闭。 */
    val pluginsEnabled: Boolean = false,
    /** Agent 是否先出计划、等用户批准再执行（对标 Cursor / Claude Code 的 Plan 模式）。 */
    val agentPlanFirst: Boolean = false,
    // ---------- Git ----------
    val gitUserName: String = "",
    val gitUserEmail: String = "",
    /** 敏感：远程地址可能内嵌 token（https://user:token@host/repo.git），存加密 SharedPreferences */
    val gitRemoteUrl: String = "",
    /** Keystore 不可用时敏感字段退回明文 prefs；设置页需明确提示，不能假装已加密 */
    val encryptionFallback: Boolean = false
) {
    companion object {
        const val DEFAULT_AI_BASE_URL = "http://127.0.0.1:11434/v1"
        const val DEFAULT_AI_MODEL = "qwen2.5-coder:3b"
    }
}

/**
 * 基于 SharedPreferences 的轻量设置存储。
 *
 * 选择 SharedPreferences 而非 DataStore：本应用只有几个标量配置，
 * 没有必要为它引入 DataStore 的协程/Flow 复杂度和额外依赖。
 *
 * 敏感字段（AI API Key、内嵌 token 的 Git 远程地址）存入 EncryptedSharedPreferences
 * （Android Keystore + AES256_GCM）；其余非敏感配置仍在明文 prefs。
 * 旧版本明文存放的敏感字段在首次升级时自动迁移到加密 prefs 并删除明文副本。
 */
class SettingsStore(context: Context) {

    private val appContext = context.applicationContext

    /** 非敏感配置：明文 SharedPreferences */
    private val prefs = appContext
        .getSharedPreferences("devterminal_settings", Context.MODE_PRIVATE)

    /**
     * 敏感配置：加密 SharedPreferences。
     * 极少数旧/定制 ROM 上 Keystore 不可用时回退到明文 prefs（至少不崩），
     * 此时 [encryptedIsFallback] 为 true，跳过迁移。
     */
    private val encrypted: SharedPreferences = createEncrypted(appContext)
    private val encryptedIsFallback: Boolean get() = encrypted === prefs
    @Volatile
    private var encryptedReadFailed = false

    /**
     * 敏感字段写盘队列。
     *
     * EncryptedSharedPreferences.edit() 会走 Keystore 加密，低端机上在主线程
     * 连续拖字号/输出高度会掉帧。这里把状态更新留在主线程，把加密写合并到
     * 单线程：连续 20 次 save 只落最后一版，且不阻塞 UI。
     */
    private val writeExecutor = Executors.newSingleThreadExecutor { r ->
        Thread(r, "codepocket-settings-write").apply { isDaemon = true }
    }
    private val pendingSensitive = AtomicReference<AppSettings?>(null)

    init {
        runCatching { migrateSensitiveFromPlaintext() }
    }

    private fun createEncrypted(context: Context): SharedPreferences = runCatching {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "devterminal_encrypted",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }.getOrElse { prefs }

    /** 旧版本把 aiApiKey / gitRemoteUrl 明文存在 devterminal_settings，升级时搬到加密 prefs。 */
    private fun migrateSensitiveFromPlaintext() {
        if (encryptedIsFallback) return
        if (!prefs.contains(KEY_AI_KEY) && !prefs.contains(KEY_GIT_REMOTE)) return
        runCatching {
            if (prefs.contains(KEY_AI_KEY)) {
                val v = prefs.getString(KEY_AI_KEY, "") ?: ""
                encrypted.edit().putString(KEY_AI_KEY, v).apply()
                prefs.edit().remove(KEY_AI_KEY).apply()
            }
            if (prefs.contains(KEY_GIT_REMOTE)) {
                val v = prefs.getString(KEY_GIT_REMOTE, "") ?: ""
                encrypted.edit().putString(KEY_GIT_REMOTE, v).apply()
                prefs.edit().remove(KEY_GIT_REMOTE).apply()
            }
        }
    }

    fun load(): AppSettings = runCatching { readSettings() }.getOrElse {
        AppSettings(encryptionFallback = true)
    }

    private fun readSettings(): AppSettings = AppSettings(
        themeMode = prefs.getString(KEY_THEME_MODE, null) ?: legacyThemeMode(),
        editorFontSize = prefs.getInt(KEY_FONT, 14),
        autoSave = prefs.getBoolean(KEY_AUTOSAVE, true),
        timeoutSeconds = prefs.getInt(KEY_TIMEOUT, 120),
        outputHeightDp = prefs.getInt(KEY_OUTPUT_H, 260),
        editorTheme = prefs.getString(KEY_EDITOR_THEME, "auto") ?: "auto",
        wordWrap = prefs.getBoolean(KEY_WORD_WRAP, false),
        autoCloseBrackets = prefs.getBoolean(KEY_AUTO_CLOSE, true),
        showLineNumbers = prefs.getBoolean(KEY_LINE_NUMBERS, true),
        aiBaseUrl = prefs.getString(KEY_AI_URL, AppSettings.DEFAULT_AI_BASE_URL)
            ?: AppSettings.DEFAULT_AI_BASE_URL,
        aiApiKey = readEncrypted(KEY_AI_KEY, ""),
        aiModel = prefs.getString(KEY_AI_MODEL, AppSettings.DEFAULT_AI_MODEL)
            ?: AppSettings.DEFAULT_AI_MODEL,
        aiConfigured = prefs.getBoolean(KEY_AI_CONFIGURED, false),
        useLocalModel = prefs.getBoolean(KEY_USE_LOCAL_MODEL, false),
        localModelId = prefs.getString(KEY_LOCAL_MODEL_ID, "minicpm5-1b") ?: "minicpm5-1b",
        mcpEnabled = prefs.getBoolean(KEY_MCP_ENABLED, false),
        mcpEndpoint = readEncrypted(KEY_MCP_ENDPOINT, ""),
        pluginsEnabled = prefs.getBoolean(KEY_PLUGINS_ENABLED, false),
        agentPlanFirst = prefs.getBoolean(KEY_AGENT_PLAN_FIRST, false),
        gitUserName = prefs.getString(KEY_GIT_NAME, "") ?: "",
        gitUserEmail = prefs.getString(KEY_GIT_EMAIL, "") ?: "",
        gitRemoteUrl = readEncrypted(KEY_GIT_REMOTE, ""),
        encryptionFallback = encryptedIsFallback || encryptedReadFailed
    )

    /** 加密 prefs 损坏（Keystore key 失效 / 文件损坏）时不让整个 App 启动崩溃。 */
    private fun readEncrypted(key: String, fallback: String): String = runCatching {
        encrypted.getString(key, fallback) ?: fallback
    }.getOrElse {
        encryptedReadFailed = true
        fallback
    }

    fun save(s: AppSettings) {
        prefs.edit()
            .putString(KEY_THEME_MODE, s.themeMode)
            .putInt(KEY_FONT, s.editorFontSize)
            .putBoolean(KEY_AUTOSAVE, s.autoSave)
            .putInt(KEY_TIMEOUT, s.timeoutSeconds)
            .putInt(KEY_OUTPUT_H, s.outputHeightDp)
            .putString(KEY_EDITOR_THEME, s.editorTheme)
            .putBoolean(KEY_WORD_WRAP, s.wordWrap)
            .putBoolean(KEY_AUTO_CLOSE, s.autoCloseBrackets)
            .putBoolean(KEY_LINE_NUMBERS, s.showLineNumbers)
            .putString(KEY_AI_URL, s.aiBaseUrl)
            .putString(KEY_AI_MODEL, s.aiModel)
            .putBoolean(KEY_AI_CONFIGURED, s.aiConfigured)
            .putBoolean(KEY_USE_LOCAL_MODEL, s.useLocalModel)
            .putString(KEY_LOCAL_MODEL_ID, s.localModelId)
            .putBoolean(KEY_MCP_ENABLED, s.mcpEnabled)
            .putBoolean(KEY_PLUGINS_ENABLED, s.pluginsEnabled)
            .putBoolean(KEY_AGENT_PLAN_FIRST, s.agentPlanFirst)
            .putString(KEY_GIT_NAME, s.gitUserName)
            .putString(KEY_GIT_EMAIL, s.gitUserEmail)
            .apply()
        // 敏感字段写加密 prefs，放到单线程合并落盘。Keystore 在极少数 ROM 上
        // 可能失效，写失败最多丢敏感字段，不能让设置页保存动作直接崩溃。
        pendingSensitive.set(s)
        writeExecutor.execute {
            while (true) {
                val latest = pendingSensitive.getAndSet(null) ?: break
                runCatching {
                    encrypted.edit()
                        .putString(KEY_AI_KEY, latest.aiApiKey)
                        .putString(KEY_GIT_REMOTE, latest.gitRemoteUrl)
                        .putString(KEY_MCP_ENDPOINT, latest.mcpEndpoint)
                        .commit()
                }.onFailure { android.util.Log.w("SettingsStore", "敏感设置写入失败", it) }
            }
        }
    }

    /**
     * 测试/退出前把队列里的最后一版敏感设置落盘。
     *
     * 不能只取 pendingSensitive：worker 可能已经把它取走、正在 commit，此时
     * 直接 return 会让 onStop 误以为已经落盘。这里往同一个单线程队列压一个
     * 屏障任务，等它之前的写任务全部完成再返回。
     */
    fun flushWrites() {
        val latch = CountDownLatch(1)
        runCatching { writeExecutor.execute { latch.countDown() } }
        runCatching { latch.await(3, TimeUnit.SECONDS) }
    }

    // ---------- 会话恢复：重启后回到上次的编辑现场 ----------

    fun saveSession(projectPath: String?, filePath: String?, tabPaths: List<String>) {
        prefs.edit()
            .putString(KEY_LAST_PROJECT, projectPath)
            .putString(KEY_LAST_FILE, filePath)
            .putString(KEY_LAST_TABS, tabPaths.joinToString("\n"))
            .apply()
    }

    fun loadSession(): SessionSnapshot = SessionSnapshot(
        projectPath = prefs.getString(KEY_LAST_PROJECT, null),
        filePath = prefs.getString(KEY_LAST_FILE, null),
        tabPaths = prefs.getString(KEY_LAST_TABS, null)
            ?.split("\n")?.filter { it.isNotBlank() } ?: emptyList(),
        cursorLine = prefs.getInt(KEY_CURSOR_LINE, 0),
        cursorCol = prefs.getInt(KEY_CURSOR_COL, 0)
    )

    /**
     * 单独保存光标位置（1 基行/列，0 表示未保存）。
     * 与 [saveSession] 分开：切文件/暂停时 UI 可高频写光标，不污染项目/Tab 现场。
     */
    fun saveCursor(cursorLine: Int, cursorCol: Int) {
        prefs.edit()
            .putInt(KEY_CURSOR_LINE, cursorLine)
            .putInt(KEY_CURSOR_COL, cursorCol)
            .apply()
    }

    /** 旧版只有深浅二选一（dark_theme 布尔）。首次升级到三态时把旧值迁到 themeMode。 */
    private fun legacyThemeMode(): String =
        if (prefs.contains(KEY_DARK)) {
            if (prefs.getBoolean(KEY_DARK, true)) ThemeModes.DARK else ThemeModes.LIGHT
        } else ThemeModes.DARK

    /** 上一次会话的编辑现场（cursorLine/cursorCol 为 1 基，0 表示无保存光标） */
    data class SessionSnapshot(
        val projectPath: String?,
        val filePath: String?,
        val tabPaths: List<String>,
        val cursorLine: Int = 0,
        val cursorCol: Int = 0
    )

    private companion object {
        const val KEY_THEME_MODE = "theme_mode"
        const val KEY_DARK = "dark_theme"
        const val KEY_FONT = "editor_font_size"
        const val KEY_AUTOSAVE = "auto_save"
        const val KEY_TIMEOUT = "timeout_seconds"
        const val KEY_OUTPUT_H = "output_height_dp"
        const val KEY_EDITOR_THEME = "editor_theme"
        const val KEY_WORD_WRAP = "word_wrap"
        const val KEY_AUTO_CLOSE = "auto_close_brackets"
        const val KEY_LINE_NUMBERS = "show_line_numbers"
        const val KEY_LAST_PROJECT = "last_project"
        const val KEY_LAST_FILE = "last_file"
        const val KEY_LAST_TABS = "last_tabs"
        const val KEY_AI_URL = "ai_base_url"
        const val KEY_AI_KEY = "ai_api_key"
        const val KEY_AI_MODEL = "ai_model"
        const val KEY_AI_CONFIGURED = "ai_configured"
        const val KEY_USE_LOCAL_MODEL = "use_local_model"
        const val KEY_LOCAL_MODEL_ID = "local_model_id"
        const val KEY_MCP_ENABLED = "mcp_enabled"
        const val KEY_MCP_ENDPOINT = "mcp_endpoint"
        const val KEY_PLUGINS_ENABLED = "plugins_enabled"
        const val KEY_AGENT_PLAN_FIRST = "agent_plan_first"
        const val KEY_GIT_NAME = "git_user_name"
        const val KEY_GIT_EMAIL = "git_user_email"
        const val KEY_GIT_REMOTE = "git_remote_url"
        const val KEY_CURSOR_LINE = "cursor_line"
        const val KEY_CURSOR_COL = "cursor_col"
    }
}

/**
 * 把主题模式解析为「实际是否深色」，供非 Composable 层（如 ViewModel 里的预览渲染）使用。
 * "system" 读系统配置的夜间模式位。
 */
fun String.resolvesDark(context: Context): Boolean = when (this) {
    ThemeModes.LIGHT -> false
    ThemeModes.DARK -> true
    else -> (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
}
