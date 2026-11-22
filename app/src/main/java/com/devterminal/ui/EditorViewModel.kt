package com.devterminal.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.devterminal.engine.EnvDiagnostics
import com.devterminal.engine.EnvReport
import com.devterminal.agent.AgentEvent
import com.devterminal.agent.AgentLoop
import com.devterminal.agent.ApprovalHandler
import com.devterminal.agent.CheckpointStore
import com.devterminal.agent.ToolCall
import com.devterminal.agent.ToolRegistry
import com.devterminal.agent.tools.ApplyPatchTool
import com.devterminal.agent.tools.ListFilesTool
import com.devterminal.agent.tools.ReadFileTool
import com.devterminal.agent.tools.SearchTextTool
import com.devterminal.agent.tools.RunFileTool
import com.devterminal.agent.tools.RunTestsTool
import com.devterminal.model.OpenAiCompatibleProvider
import com.devterminal.workspace.LocalWorkspace
import com.devterminal.engine.AiClient
import com.devterminal.engine.EngineCommandRunner
import com.devterminal.engine.EnvironmentInstaller
import com.devterminal.engine.ExecutionService
import com.devterminal.engine.FriendlyError
import com.devterminal.engine.GitManager
import com.devterminal.engine.LanguageRegistry
import com.devterminal.engine.LanguageSpec
import com.devterminal.engine.RuntimeRegistry
import com.devterminal.engine.RunEvent
import com.devterminal.engine.RunRequest
import com.devterminal.engine.RunEngine
import com.devterminal.engine.EngineProvider
import com.devterminal.project.FileNode
import com.devterminal.project.ProjectManager
import com.devterminal.project.sanitizeFileName
import com.devterminal.project.Templates
import com.devterminal.settings.resolvesDark
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.yield
import java.io.File

enum class EnvState { PREPARING, READY, ERROR }

/** 输出面板最多保留的行数：死循环式输出若不加闸，几秒就能把内存吃干 */
private const val MAX_OUTPUT_LINES = 3000

/** 遍历项目时要跳过的噪音目录（既无意义又拖慢速度） */
private val WALK_EXCLUDED = setOf(".git", "build", "__pycache__", "node_modules", ".gradle", ".idea")

data class UiState(
    val envState: EnvState = EnvState.PREPARING,
    val envMessage: String = "正在准备离线运行环境…",
    val tree: FileNode? = null,
    val currentFile: File? = null,
    val editorText: String = "",
    val dirty: Boolean = false,
    val output: List<String> = emptyList(),
    val running: Boolean = false,
    val exitCode: Int? = null,
    val message: String? = null,
    /**
     * 提示序号：内容相同的两条消息（例如连续两次「已保存」）也能各自弹出一次。
     * 只以 message 做 LaunchedEffect 的 key 时，第二条会被判为「无变化」而吞掉。
     */
    val messageSeq: Long = 0,
    /** 是否显示交互输入行（运行中且进程可接收输入） */
    val inputVisible: Boolean = false,
    /** 用户待发送的输入内容 */
    val inputDraft: String = "",
    /** 环境自检结果（就绪后可查看） */
    val diagnostics: EnvReport? = null,
    /** 根据报错生成的友好提示 */
    val friendlyHint: String? = null,
    /** 解压进度 0..1，-1 表示不确定 */
    val installProgress: Float = -1f,
    /** 运行配置：命令行参数（空格分隔） */
    val runArgs: String = "",
    /** 用户设置 */
    val settings: com.devterminal.settings.AppSettings = com.devterminal.settings.AppSettings(),
    /** 顶部打开的文件 Tab 列表 */
    val openTabs: List<File> = emptyList(),
    /** 当前文件的语言名（状态栏显示用，按扩展名识别而非写死两种） */
    val languageLabel: String = "Python",
    /** 工具链里是否带了 git 二进制（初始化时探一次，避免在主线程做 IO） */
    val gitInstalled: Boolean = false,
    // ---------- 查找 / 替换 ----------
    val findVisible: Boolean = false,
    val findQuery: String = "",
    val findReplaceWith: String = "",
    val findReplaceMode: Boolean = false,
    /** 所有匹配的全局字符偏移 */
    val findMatches: List<Int> = emptyList(),
    /** 当前停在的匹配序号（findMatches 下标） */
    val findIndex: Int = 0,
    /** 跳转请求序号，每次自增触发编辑器执行 */
    val findRequestId: Long = 0,
    // ---------- 状态栏 ----------
    val cursorLine: Int = 1,
    val cursorColumn: Int = 1,
    // ---------- 符号栏 ----------
    /** 每次自增插入一次 insertText */
    val insertSignal: Long = 0,
    val insertText: String? = null,
    /** 每次自增退格一次 */
    val backspaceSignal: Long = 0,
    // ---------- Git（v0.3） ----------
    val gitStatus: GitManager.GitStatus? = null,
    val gitBusy: Boolean = false,
    val gitLastResult: String? = null,
    // ---------- AI 助手（v0.3） ----------
    val aiMessages: List<AiClient.ChatMessage> = emptyList(),
    val aiBusy: Boolean = false,
    val aiInputDraft: String = "",
    // ---------- Agent（v0.4） ----------
    val agentEvents: List<AgentEvent> = emptyList(),
    val agentBusy: Boolean = false,
    val agentInputDraft: String = "",
    val agentPendingCall: ToolCall? = null,
    val agentPendingProposal: AgentEvent.PatchProposed? = null,
    val lastAgentCheckpoint: AgentEvent.Checkpoint? = null,
    val agentCheckpoints: List<AgentEvent.Checkpoint> = emptyList(),
    // ---------- 全局搜索（v0.3） ----------
    val globalSearching: Boolean = false,
    val globalResults: List<SearchHit> = emptyList(),
    // ---------- 实时预览（v0.5，Markdown / HTML） ----------
    /** 预览分屏是否展开（仅当前文件为 .md/.html 时可开） */
    val previewVisible: Boolean = false,
    /** 预览面板的完整 HTML 文档（防抖后由 renderPreview 刷新） */
    val previewHtml: String = "",
    // ---------- 会话恢复：光标定位（-1=无请求） ----------
    val restoreCursorLine: Int = -1,
    val restoreCursorCol: Int = 0,
    /** 每次自增触发编辑器把光标移到 restoreCursorLine/Col */
    val restoreCursorSeq: Long = 0,
    // ---------- 撤销 / 重做 ----------
    /** 每次自增触发一次 undo / redo */
    val undoSignal: Long = 0,
    val redoSignal: Long = 0,
    /** 跳转到指定行的请求（从命令面板触发，0 基行号 + 自增 seq） */
    val gotoLineRequest: ScrollToLineRequest? = null
)

class EditorViewModel(app: Application) : AndroidViewModel(app) {

    private val context = app.applicationContext
    private val installer = EnvironmentInstaller(context)

    /**
     * 真离线执行引擎：原生 CPython（PEP 738 官方 Android 支持，
     * libpython 随 APK 打包，零外部依赖）。引擎切换对 UI 透明（RunEngine 接口）。
     *
     * P1-2：延迟到 prepareEnvironment() 内构造。缺 .so / 错 ABI / 缺 stdlib.zip 时
     * EngineProvider.create 会抛 IllegalStateException；放字段初始化器会在 ViewModel
     * 构造期直接闪退，走不到 MissingToolchainScreen。这里改 lateinit + runCatching 兜底。
     */
    private var pythonEngine: RunEngine? = null
    private var runtimes: RuntimeRegistry? = null
    private var aiJob: Job? = null
    private var aiCancelRequested = false
    private var agentJob: Job? = null
    private var agentApproval: CompletableDeferred<Boolean>? = null
    private var activeCheckpointStore: CheckpointStore? = null
    /** 当前这次运行使用的引擎，stop/sendInput 必须打到同一个实例 */
    private var activeEngine: RunEngine? = null
    private val projects = ProjectManager(installer)
    private val settingsStore = com.devterminal.settings.SettingsStore(context)

    private val _ui = MutableStateFlow(UiState(settings = settingsStore.load()))
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    /** 当前项目根目录（默认取第一个项目） */
    private var currentProject: File? = null

    private val git = GitManager()

    /** P2-5：光标持久化节流 job，连续移动时取消上一次 */
    private var cursorSaveJob: kotlinx.coroutines.Job? = null

    init {
        prepareEnvironment()
    }

    private fun prepareEnvironment() {
        viewModelScope.launch {
            // 原生运行时随 APK 打包，无需解压/下载；这里只做目录初始化与解释器预热。
            val ok = withContext(Dispatchers.IO) {
                runCatching { installer.ensureDirs() }.isSuccess
            }
            if (!ok) {
                _ui.update { it.copy(
                    envState = EnvState.ERROR,
                    envMessage = "工作目录初始化失败",
                    message = "无法创建应用私有目录",
                    messageSeq = it.messageSeq + 1
                ) }
                return@launch
            }

            // P1-2：在协程内构造引擎，构造失败（缺 .so/错 ABI/缺 stdlib.zip）不闪退，
            // 而是置 ERROR 态，由 MissingToolchainScreen + 重试按钮接管。
            val engineOk = withContext(Dispatchers.IO) {
                runCatching { pythonEngine = EngineProvider.create(context) }.isSuccess
            }
            // 即使 Python 原生库不可用（非 arm64 / 资产缺失），也把纯 Java 的 JS/Lua 撑起来。
            runtimes = RuntimeRegistry(pythonEngine)
            pythonEngine?.warmup()
            runtimes?.warmup()

            val hasGit = withContext(Dispatchers.IO) { git.isGitInstalled() }
            _ui.update { it.copy(
                envState = EnvState.READY,
                envMessage = if (engineOk) "离线环境就绪（Python · JavaScript · Lua）"
                             else "JavaScript / Lua 就绪（Python 当前不可用）",
                installProgress = -1f,
                gitInstalled = hasGit,
                output = buildList {
                    add("[CodePocket] 离线环境已就绪，全程无需联网。")
                    if (engineOk) add("[CodePocket] Python 由原生 CPython 执行；JavaScript 由 Rhino、Lua 由 LuaJ 执行。")
                    else add("[CodePocket] Python 原生库不可用（常见于非 arm64 设备），JavaScript/Lua 仍可运行。")
                    add("[CodePocket] 其余 17 种语言提供编辑、语法高亮与静态补全。")
                }
            ) }
            restoreSession()
            // 后台跑一次自检，不阻塞用户开始写代码
            runDiagnostics()
        }
    }

    /** 重新尝试初始化环境（用户在引导页点「重试」时调用） */
    fun retryPrepare() {
        _ui.update { it.copy(
            envState = EnvState.PREPARING,
            envMessage = "正在重新检查离线环境…",
            installProgress = -1f,
            message = null
        ) }
        prepareEnvironment()
    }

    /** 后台执行环境自检并把结果推给 UI */
    fun runDiagnostics() {
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) { EnvDiagnostics.run(context) }
            _ui.update { it.copy(
                diagnostics = result,
                message = result.summary() + "（" + EnvDiagnostics.formatSize(result.installedSizeBytes) + "）",
                messageSeq = it.messageSeq + 1
            ) }
        }
    }

    // ---------- 会话恢复：重启后回到上次的编辑现场 ----------

    /**
     * 恢复上次会话：上次项目 → 上次打开的 Tab 列表 → 上次激活的文件。
     * 全部失效时回退到默认项目（首个项目或新建模板项目）。
     */
    private fun restoreSession() {
        viewModelScope.launch {
            val snap = settingsStore.loadSession()
            val defaultProject = withContext(Dispatchers.IO) {
                projects.ensureInitialized()
                projects.listProjects().firstOrNull()
                    ?: projects.createFromTemplate(Templates.PYTHON_HELLO)
            }
            val projectDir = snap.projectPath?.let { File(it) }
                ?.takeIf { it.isDirectory && it.parentFile == projects.root }
                ?: defaultProject
            currentProject = projectDir
            refreshTree()

            // 恢复 Tab 列表（剔除已不存在的文件）
            val tabs = snap.tabPaths.map { File(it) }.filter { it.isFile }
            val active = snap.filePath?.let { File(it) }?.takeIf { it.isFile && tabs.contains(it) }
                ?: tabs.firstOrNull()
            _ui.update { it.copy(openTabs = tabs) }
            if (active != null) {
                doOpenFile(active, restore = true)
                // 恢复上次光标位置（SettingsStore 的 cursorLine/cursorCol 为 1 基，换算成编辑器的 0 基）
                val cLine = snap.cursorLine
                val cCol = snap.cursorCol
                if (cLine > 0) {
                    _ui.update {
                        it.copy(
                            restoreCursorLine = (cLine - 1).coerceAtLeast(0),
                            restoreCursorCol = (cCol - 1).coerceAtLeast(0),
                            restoreCursorSeq = it.restoreCursorSeq + 1
                        )
                    }
                }
            }
        }
    }

    /** 把当前编辑现场写进偏好，App 被杀后也能回来 */
    private fun saveSession() {
        val st = _ui.value
        settingsStore.saveSession(
            projectPath = currentProject?.absolutePath,
            filePath = st.currentFile?.absolutePath,
            tabPaths = st.openTabs.map { it.absolutePath }
        )
    }

    // ---------- 项目 / 文件 ----------

    fun openProject(dir: File) {
        viewModelScope.launch {
            // 切项目前先把当前脏文件落盘；失败就不切，绝不静默丢代码。
            if (!persistCurrentIfDirty()) return@launch
            if (_ui.value.dirty) {
                _ui.update { it.copy(message = "保存期间有新输入，已取消切换", messageSeq = it.messageSeq + 1) }
                return@launch
            }
            switchProject(dir)
        }
    }

    /** 实际的工程切换：只做状态清理，不负责保存。 */
    private fun switchProject(dir: File) {
        currentProject = dir
        _ui.update {
            it.copy(openTabs = emptyList(), currentFile = null, editorText = "", dirty = false)
        }
        refreshTree()
        saveSession()
    }

    /**
     * 保存当前文件（如果有脏改动）。
     * 返回 false 表示写入失败；调用方应中止切项目/关 Tab。
     * 写入后再次比对文本，防止保存期间的输入被 dirty=false 误抹掉。
     */
    private suspend fun persistCurrentIfDirty(): Boolean {
        val st = _ui.value
        val file = st.currentFile ?: return true
        if (!st.dirty) return true
        val snapshot = st.editorText
        val ok = runCatching {
            withContext(Dispatchers.IO) { projects.write(file.absolutePath, snapshot) }
        }.isSuccess
        if (!ok) {
            _ui.update { it.copy(message = "保存失败，操作已取消：${file.name}", messageSeq = it.messageSeq + 1) }
            return false
        }
        _ui.update { cur ->
            if (cur.currentFile?.absolutePath == file.absolutePath && cur.editorText == snapshot) {
                cur.copy(dirty = false)
            } else cur
        }
        return true
    }

    /** P2-7：按最近修改时间取最近 8 个项目，供命令面板「最近打开」 */
    fun recentProjects(): List<File> =
        runCatching {
            projects.listProjects().sortedByDescending { it.lastModified() }.take(8)
        }.getOrDefault(emptyList())

    private fun refreshTree() {
        val dir = currentProject ?: return
        // 递归遍历目录属于阻塞 IO，放到后台线程
        viewModelScope.launch {
            val tree = withContext(Dispatchers.IO) { projects.buildTree(dir) }
            _ui.update { it.copy(tree = tree) }
        }
    }

    fun openFile(file: File) {
        if (file.isDirectory) return
        val st = _ui.value
        val previous = st.currentFile
        // 自动保存：切走前先落盘，避免改动丢失
        if (st.settings.autoSave && st.dirty && previous != null) {
            viewModelScope.launch {
                val ok = runCatching {
                    withContext(Dispatchers.IO) { projects.write(previous.absolutePath, st.editorText) }
                }.isSuccess
                if (!ok) {
                    _ui.update { it.copy(message = "保存失败，已取消切换：${previous.name}",
                        messageSeq = it.messageSeq + 1) }
                    return@launch
                }
                doOpenFile(file)
            }
        } else {
            doOpenFile(file)
        }
    }

    private fun doOpenFile(file: File, restore: Boolean = false) {
        viewModelScope.launch {
            val content = withContext(Dispatchers.IO) { projects.read(file.absolutePath) }
            _ui.update { st ->
                st.copy(
                    currentFile = file,
                    editorText = content,
                    dirty = false,
                    languageLabel = LanguageRegistry.labelOf(file),
                    // 切到不可预览的文件时自动收起预览分屏，避免留下空面板
                    previewVisible = st.previewVisible && isPreviewable(file),
                    // 打开新文件自动挂到 Tab 条上（已打开的不重复加）
                    openTabs = st.openTabs.let { tabs ->
                        if (tabs.any { it.absolutePath == file.absolutePath }) tabs else tabs + file
                    }
                )
            }
            if (!restore) saveSession()
        }
    }

    /** 关闭一个 Tab；若关的是当前文件则自动切到相邻 Tab */
    fun closeTab(file: File) {
        val st = _ui.value
        val idx = st.openTabs.indexOfFirst { it.absolutePath == file.absolutePath }
        if (idx < 0) return
        val closingCurrent = st.currentFile?.absolutePath == file.absolutePath
        if (closingCurrent && st.dirty) {
            viewModelScope.launch {
                if (!persistCurrentIfDirty()) return@launch
                if (_ui.value.dirty) {
                    _ui.update { it.copy(message = "保存期间有新输入，请再关一次", messageSeq = it.messageSeq + 1) }
                    return@launch
                }
                closeTabInternal(file)
            }
        } else {
            closeTabInternal(file)
        }
    }

    private fun closeTabInternal(file: File) {
        val st = _ui.value
        val idx = st.openTabs.indexOfFirst { it.absolutePath == file.absolutePath }
        if (idx < 0) return
        val newTabs = st.openTabs.filterNot { it.absolutePath == file.absolutePath }
        if (st.currentFile?.absolutePath == file.absolutePath) {
            // dirty 已在上层保存；这里只负责切换/清空
            val next = newTabs.getOrNull(idx) ?: newTabs.getOrNull(idx - 1)
            _ui.update { it.copy(openTabs = newTabs) }
            if (next != null) {
                doOpenFile(next)
            } else {
                _ui.update { it.copy(currentFile = null, editorText = "", dirty = false) }
                saveSession()
            }
        } else {
            _ui.update { it.copy(openTabs = newTabs) }
            saveSession()
        }
    }

    fun onEditorChanged(newText: String) {
        // 用 update 做原子读改写：并发协程下不会互相覆盖
        _ui.update { st ->
            if (st.editorText == newText) st else st.copy(editorText = newText, dirty = true)
        }
    }

    fun save(saveMessage: Boolean = true) {
        val st = _ui.value
        val file = st.currentFile ?: return
        val snapshot = st.editorText
        viewModelScope.launch {
            val ok = runCatching {
                withContext(Dispatchers.IO) { projects.write(file.absolutePath, snapshot) }
            }.isSuccess
            _ui.update { cur ->
                if (!ok) {
                    cur.copy(message = "保存失败：${file.name}", messageSeq = cur.messageSeq + 1)
                } else if (cur.currentFile?.absolutePath == file.absolutePath && cur.editorText == snapshot) {
                    if (saveMessage) cur.copy(dirty = false, message = "已保存 ${file.name}",
                        messageSeq = cur.messageSeq + 1)
                    else cur.copy(dirty = false)
                } else {
                    // IO 期间又有新输入：旧快照已落盘，但当前内容仍未保存，保持 dirty。
                    cur
                }
            }
        }
    }

    /** 切后台 / 系统回收前静默落盘（对标已发布编辑器的数据安全底线） */
    fun saveOnBackground() {
        val st = _ui.value
        if (st.dirty && st.currentFile != null) save(saveMessage = false)
    }

    // ---------- 运行 ----------

    fun runCurrent() {
        val st = _ui.value
        // 防止重复点击导致多个进程并发、输出互相穿插
        if (st.running) return
        if (st.agentBusy) {
            _ui.update { it.copy(message = "Agent 正在执行，先停止 Agent 再运行", messageSeq = it.messageSeq + 1) }
            return
        }
        val file = st.currentFile ?: run {
            _ui.update { it.copy(message = "请先打开一个文件", messageSeq = it.messageSeq + 1) }
            return
        }
        // 运行前自动保存，保证跑的是最新代码
        if (st.dirty) {
            viewModelScope.launch {
                withContext(Dispatchers.IO) { projects.write(file.absolutePath, st.editorText) }
                _ui.update { it.copy(dirty = false) }
                launchRun(file, LanguageRegistry.forFile(file), runtimes?.engineFor(LanguageRegistry.forFile(file).id))
            }
        } else {
            launchRun(file, LanguageRegistry.forFile(file), runtimes?.engineFor(LanguageRegistry.forFile(file).id))
        }
    }

    private fun launchRun(file: File, spec: LanguageSpec, engine: RunEngine?) {
        if (!spec.isRunnable) {
            _ui.update { it.copy(
                message = "${spec.displayName} 仅支持编辑、语法高亮与补全",
                messageSeq = it.messageSeq + 1
            ) }
            return
        }
        if (engine == null) {
            _ui.update { it.copy(
                message = "${spec.displayName} 运行时未接入",
                messageSeq = it.messageSeq + 1
            ) }
            return
        }
        activeEngine = engine
        val projectDir = currentProject ?: file.parentFile ?: file
        _ui.update { it.copy(
            running = true, output = emptyList(), exitCode = null,
            // 默认不弹键盘/不展开 stdin 行：避免每次运行都把键盘顶起来；
            // 需要交互 input() 的程序由用户在输出区点「点击输入」手动展开。
            inputVisible = false, inputDraft = "", friendlyHint = null,
            message = "运行 ${file.name} …", messageSeq = it.messageSeq + 1
        ) }
        // 提升为前台服务，避免 Android 12+ 在后台把进程杀掉
        runCatching { ExecutionService.start(context, "正在运行 ${file.name}") }
        viewModelScope.launch {
            try {
                // P1-3：高频 print 不逐行重组 5000 行列表——先攒批，再一次性并入 UI 状态。
                // 每 256 行或 100ms 落一次，既保证输出可见，又避免主线程被 O(n) 拷贝拖死。
                val pendingLines = ArrayList<String>(256)
                var lastFlushNanos = System.nanoTime()
                fun flushPending() {
                    if (pendingLines.isEmpty()) return
                    val lines = pendingLines.toTypedArray()
                    pendingLines.clear()
                    _ui.update { st -> st.copy(output = appendLines(st.output, *lines)) }
                }
                // 单行输出后程序可能停在 input()，不能等下一次事件才刷新；100ms 定时落批。
                launch {
                    while (true) {
                        delay(100)
                        flushPending()
                        lastFlushNanos = System.nanoTime()
                    }
                }
                engine.run(
                    RunRequest(
                        scriptPath = file.absolutePath,
                        workingDir = projectDir.absolutePath,
                        languageId = spec.id,
                        // 支持带引号的参数，如: --name "hello world"
                        args = parseArgs(_ui.value.runArgs)
                    ),
                    // 超时时长来自用户设置
                    timeoutMs = _ui.value.settings.timeoutSeconds * 1000L
                ).collect { event ->
                when (event) {
                    is RunEvent.Started -> pendingLines.add("[执行] ${event.command}")
                    is RunEvent.Stdout -> pendingLines.add(event.line)
                    is RunEvent.Stderr -> pendingLines.add("[err] ${event.line}")
                    // 引擎日志（如首次预热提示）：以灰字混入输出，不打断流程
                    is RunEvent.Log -> pendingLines.add("[引擎] ${event.message}")
                    is RunEvent.Finished -> {
                        flushPending()
                        _ui.update { st ->
                            // 非零退出时，尝试把报错翻译成人话
                            val hint = if (event.exitCode != 0) FriendlyError.hint(st.output, spec.id) else null
                            st.copy(
                                running = false,
                                exitCode = event.exitCode,
                                inputVisible = false,
                                friendlyHint = hint,
                                output = appendLines(
                                    st.output,
                                    "—— 进程结束，退出码 ${event.exitCode}（${event.durationMs} ms）——",
                                    *(hint?.let { arrayOf("", "💡 $it") } ?: emptyArray())
                                ),
                                message = if (event.exitCode == 0) "运行成功" else "运行出错，见下方提示",
                                messageSeq = st.messageSeq + 1
                            )
                        }
                    }
                    is RunEvent.Failed -> {
                        flushPending()
                        _ui.update { st ->
                            val hint = FriendlyError.hint(listOf(event.message), spec.id)
                            st.copy(
                                running = false,
                                inputVisible = false,
                                output = appendLines(
                                    st.output, "[启动失败] ${event.message}",
                                    *(hint?.let { arrayOf("", "💡 $it") } ?: emptyArray())
                                ),
                                friendlyHint = hint,
                                message = event.message,
                                messageSeq = st.messageSeq + 1
                            )
                        }
                    }
                    // 未来引擎新增的事件类型不阻断运行（如 NeedsInput 暂以手动展开为准）
                    else -> Unit
                }
                if (pendingLines.size >= 256 || System.nanoTime() - lastFlushNanos >= 100_000_000L) {
                    flushPending()
                    lastFlushNanos = System.nanoTime()
                    yield()
                }
                }
            } finally {
                if (activeEngine === engine) activeEngine = null
                // 运行结束，撤掉前台服务（避免通知栏常驻）
                runCatching { ExecutionService.stop(context) }
            }
        }
    }

    /** 追加输出行并守住行数上限，避免死循环输出把内存打满 */
    private fun appendLines(current: List<String>, vararg lines: String): List<String> {
        val merged = current + lines
        if (merged.size <= MAX_OUTPUT_LINES) return merged
        // 超限时保留最后 N 行，并在最前面插一条 muted 截断提示，让用户知道丢了一段
        val tail = merged.takeLast(MAX_OUTPUT_LINES)
        val hint = "[输出已截断，仅保留最后 $MAX_OUTPUT_LINES 行]"
        return if (tail.firstOrNull() == hint) tail else listOf(hint) + tail
    }

    /**
     * 向运行中的进程发送一行输入（支持 Python 的 input() 交互）。
     * 写管道可能阻塞，因此整体切到 IO 线程，绝不卡主线程。
     */
    private fun activeEngine(): RunEngine? = activeEngine ?: pythonEngine

    fun sendInput(text: String) {
        val st = _ui.value
        if (!st.running) return
        val engine = activeEngine() ?: return
        viewModelScope.launch {
            val ok = withContext(Dispatchers.IO) { engine.writeStdin(text) }
            _ui.update {
                if (ok) it.copy(output = appendLines(it.output, text), inputDraft = "")
                else it.copy(message = "当前进程不接受输入", messageSeq = it.messageSeq + 1)
            }
        }
    }

    /** 发送 EOF（等价 Ctrl-D） */
    fun sendEof() {
        if (!_ui.value.running) return
        val engine = activeEngine() ?: return
        viewModelScope.launch {
            withContext(Dispatchers.IO) { engine.closeStdin() }
            _ui.update { it.copy(message = "已发送 EOF", messageSeq = it.messageSeq + 1) }
        }
    }

    /**
     * 请求停止当前运行。
     *
     * 不再立即把 UI 置为「已停止」——运行状态的唯一权威来源是引擎的 Finished 事件：
     * 引擎真正收尾（KeyboardInterrupt 或强杀）后才会发出，此时 UI 才翻回可运行态，
     * 避免「UI 说停了、进程还在跑」的状态脱节。点击后先给用户「正在停止」反馈。
     */
    fun stopRun() {
        val st = _ui.value
        if (!st.running) return
        val engine = activeEngine() ?: return
        viewModelScope.launch {
            withContext(Dispatchers.IO) { engine.stop() }
            runCatching { ExecutionService.stop(context) }
            _ui.update {
                it.copy(message = "正在停止…", messageSeq = it.messageSeq + 1)
            }
            // 兜底：引擎看门狗若未在 8s 内发出 Finished，UI 强制翻回可运行态，
            // 避免按钮永远卡在「停止」态。正常路径由引擎 Finished 事件收尾。
            // P4-2：8s 而非 3s——中断本身要给 2s 生效时间，脚本清理还需余量；
            // 且引擎 busy 只在 execFile 真正返回后才复位，UI 过早翻转只会让
            // 用户点「运行」时得到"已有程序在运行中"。
            kotlinx.coroutines.delay(8_000L)
            if (_ui.value.running) {
                _ui.update {
                    it.copy(
                        running = false,
                        inputVisible = false,
                        exitCode = it.exitCode ?: -1,
                        output = appendLines(
                            it.output,
                            "[CodePocket] 引擎未响应停止，界面已强制复位。" +
                                "若再次运行提示\"已有程序在运行中\"，说明旧进程仍在收尾，请稍候重试。"
                        )
                    )
                }
                runCatching { ExecutionService.stop(context) }
            }
        }
    }

    fun onInputDraftChanged(text: String) {
        _ui.update { it.copy(inputDraft = text) }
    }

    /** 运行中由用户手动展开 stdin 输入行（猜数字等交互程序用） */
    fun openInput() {
        _ui.update { it.copy(inputVisible = true) }
    }

    fun onRunArgsChanged(text: String) {
        _ui.update { it.copy(runArgs = text) }
    }

    /**
     * 解析命令行参数。支持双引号包裹含空格的参数：
     *   --name "hello world" -v  →  ["--name", "hello world", "-v"]
     */
    private fun parseArgs(raw: String): List<String> {
        if (raw.isBlank()) return emptyList()
        val result = mutableListOf<String>()
        val sb = StringBuilder()
        var inQuote = false
        raw.forEach { c ->
            when {
                c == '"' -> inQuote = !inQuote
                c == ' ' && !inQuote -> {
                    if (sb.isNotEmpty()) { result.add(sb.toString()); sb.clear() }
                }
                else -> sb.append(c)
            }
        }
        if (sb.isNotEmpty()) result.add(sb.toString())
        return result
    }

    fun newProject(templateId: String) {
        val tpl = Templates.all.firstOrNull { it.id == templateId } ?: Templates.PYTHON_HELLO
        viewModelScope.launch {
            // 先保住旧项目的脏文件，再建新项目；不要先切走再异步保存。
            if (!persistCurrentIfDirty()) return@launch
            if (_ui.value.dirty) {
                _ui.update { it.copy(message = "保存期间有新输入，已取消新建", messageSeq = it.messageSeq + 1) }
                return@launch
            }
            val dir = withContext(Dispatchers.IO) { projects.createFromTemplate(tpl) }
            switchProject(dir)
            _ui.update {
                it.copy(message = "已创建项目 ${dir.name}", messageSeq = it.messageSeq + 1)
            }
            // 新项目自动打开主文件
            val main = withContext(Dispatchers.IO) {
                dir.walkTopDown().firstOrNull { it.isFile && LanguageRegistry.isRunnable(it) }
            }
            if (main != null) doOpenFile(main)
        }
    }

    fun newFile(fileName: String) {
        val dir = currentProject ?: return
        viewModelScope.launch {
            val f = withContext(Dispatchers.IO) { projects.createFile(dir.absolutePath, fileName) }
            refreshTree()
            openFile(f)
        }
    }

    fun deleteFile(file: File) {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { projects.delete(file) }
            _ui.update { st ->
                st.copy(
                    currentFile = st.currentFile?.takeUnless { it.path == file.path },
                    editorText = if (st.currentFile?.path == file.path) "" else st.editorText,
                    // 从 Tab 条同步移除
                    openTabs = st.openTabs.filterNot { it.absolutePath == file.absolutePath },
                    message = "已删除 ${file.name}",
                    messageSeq = st.messageSeq + 1
                )
            }
            refreshTree()
            saveSession()
        }
    }

    fun renameFile(file: File, newName: String) {
        viewModelScope.launch {
            // 重命名的是当前脏文件时，先把内容落盘；否则后面 doOpenFile 会读到旧内容。
            if (_ui.value.currentFile?.absolutePath == file.absolutePath && _ui.value.dirty) {
                if (!persistCurrentIfDirty()) return@launch
                if (_ui.value.dirty) {
                    _ui.update { it.copy(message = "保存期间有新输入，请再重命名", messageSeq = it.messageSeq + 1) }
                    return@launch
                }
            }
            val renamed = withContext(Dispatchers.IO) { projects.rename(file, newName) }
            if (renamed == null) {
                _ui.update { it.copy(message = "重命名失败：名称已存在或非法", messageSeq = it.messageSeq + 1) }
            } else {
                val st = _ui.value
                if (st.currentFile?.path == file.path) {
                    doOpenFile(renamed)
                }
                // 同步 Tab 列表里的旧路径
                _ui.update {
                    it.copy(
                        openTabs = it.openTabs.map { t ->
                            if (t.absolutePath == file.absolutePath) renamed else t
                        },
                        message = "已重命名为 ${renamed.name}",
                        messageSeq = it.messageSeq + 1
                    )
                }
                refreshTree()
                saveSession()
            }
        }
    }

    fun clearOutput() {
        _ui.update { it.copy(output = emptyList(), exitCode = null, friendlyHint = null) }
    }

    fun consumeMessage() { _ui.update { it.copy(message = null) } }

    // ---------- 实时预览（Markdown / HTML） ----------

    /** 当前文件是否可预览 */
    fun isPreviewable(file: File?): Boolean =
        file?.extension?.lowercase() in setOf("md", "markdown", "htm", "html")

    /** 切换预览分屏；打开时立即渲染一次 */
    fun togglePreview() {
        val file = _ui.value.currentFile
        if (!_ui.value.previewVisible && !isPreviewable(file)) {
            _ui.update { it.copy(message = "只有 .md / .html 文件支持预览", messageSeq = it.messageSeq + 1) }
            return
        }
        _ui.update { it.copy(previewVisible = !it.previewVisible) }
        if (_ui.value.previewVisible) renderPreview()
    }

    /**
     * 按当前文件与内容生成预览 HTML。
     * 在编辑分屏打开期间，由 UI 层对 editorText 做防抖后调用（collectLatest + delay）。
     */
    fun renderPreview() {
        val file = _ui.value.currentFile ?: return
        val text = _ui.value.editorText
        val dark = _ui.value.settings.themeMode.resolvesDark(context)
        viewModelScope.launch {
            val html = withContext(Dispatchers.Default) {
                when (file.extension.lowercase()) {
                    "htm", "html" -> com.devterminal.engine.MarkdownRenderer.pageForHtml(text, dark)
                    else -> com.devterminal.engine.MarkdownRenderer.pageForMarkdown(text, dark)
                }
            }
            // 只在预览仍然打开时落地，避免快速开关后旧结果闪现
            if (_ui.value.previewVisible) _ui.update { it.copy(previewHtml = html) }
        }
    }

    /** 更新设置并持久化 */
    fun updateSettings(newSettings: com.devterminal.settings.AppSettings) {
        settingsStore.save(newSettings)
        _ui.update { it.copy(settings = newSettings) }
    }

    /** 拖拽结束后记录输出面板高度（拖动过程走 UI 本地状态，结束才落盘） */
    fun persistOutputHeight(dp: Int) {
        val s = _ui.value.settings
        if (s.outputHeightDp != dp) updateSettings(s.copy(outputHeightDp = dp))
    }

    // ---------- 状态栏 ----------

    /** 编辑器光标变化（行、列，从 0 计） */
    fun onCursorChanged(line: Int, column: Int) {
        _ui.update { it.copy(cursorLine = line + 1, cursorColumn = column + 1) }
        // P2-5：节流持久化光标——1.5s 内连续移动只落盘最后一次，供冷启动恢复。
        cursorSaveJob?.cancel()
        cursorSaveJob = viewModelScope.launch {
            kotlinx.coroutines.delay(1500L)
            saveCursor()
        }
    }

    /** 把当前光标位置（UiState 中已为 1 基）写入 SettingsStore */
    fun saveCursor() {
        val st = _ui.value
        runCatching { settingsStore.saveCursor(st.cursorLine, st.cursorColumn) }
    }

    // ---------- 符号栏 ----------

    /** 在光标处插入一段文本（符号 / Tab） */
    fun insertSymbol(text: String) {
        _ui.update { st -> st.copy(insertSignal = st.insertSignal + 1, insertText = text) }
    }

    /** 光标处退格 */
    fun backspaceSymbol() {
        _ui.update { st -> st.copy(backspaceSignal = st.backspaceSignal + 1) }
    }

    // ---------- 撤销 / 重做（信号驱动编辑器内部栈） ----------

    fun undo() { _ui.update { st -> st.copy(undoSignal = st.undoSignal + 1) } }
    fun redo() { _ui.update { st -> st.copy(redoSignal = st.redoSignal + 1) } }

    // ---------- 查找 / 替换 ----------

    fun showFind(show: Boolean) {
        _ui.update {
            if (show) it.copy(findVisible = true)
            else it.copy(findVisible = false, findMatches = emptyList(), findIndex = 0, findQuery = "")
        }
    }

    fun onFindQueryChanged(query: String) {
        _ui.update { st ->
            val matches = computeMatches(st.editorText, query)
            st.copy(
                findQuery = query,
                findMatches = matches,
                findIndex = 0,
                findRequestId = if (matches.isNotEmpty()) st.findRequestId + 1 else st.findRequestId
            )
        }
    }

    fun onFindReplaceChanged(text: String) {
        _ui.update { it.copy(findReplaceWith = text) }
    }

    fun toggleFindReplaceMode() {
        _ui.update { it.copy(findReplaceMode = !it.findReplaceMode) }
    }

    fun findNext() = stepFind(1)
    fun findPrev() = stepFind(-1)

    private fun stepFind(delta: Int) {
        _ui.update { st ->
            if (st.findMatches.isEmpty()) return@update st
            val size = st.findMatches.size
            val idx = ((st.findIndex + delta) % size + size) % size
            st.copy(findIndex = idx, findRequestId = st.findRequestId + 1)
        }
    }

    fun replaceOne() {
        _ui.update { st ->
            val content = st.editorText
            val pos = st.findMatches.getOrNull(st.findIndex) ?: return@update st
            val end = pos + st.findQuery.length
            if (end > content.length) return@update st
            val newText = content.substring(0, pos) + st.findReplaceWith + content.substring(end)
            val matches = computeMatches(newText, st.findQuery)
            st.copy(
                editorText = newText,
                dirty = true,
                findMatches = matches,
                findIndex = if (matches.isEmpty()) 0 else (st.findIndex % matches.size)
            )
        }
    }

    fun replaceAll() {
        _ui.update { st ->
            if (st.findQuery.isEmpty()) return@update st
            val newText = st.editorText.replace(st.findQuery, st.findReplaceWith)
            st.copy(
                editorText = newText,
                dirty = true,
                findMatches = computeMatches(newText, st.findQuery),
                findIndex = 0
            )
        }
    }

    /** 当前查找状态的匹配信息，如「2/5」；无可匹配时为 null */
    fun findMatchInfo(st: UiState): String? =
        if (st.findMatches.isEmpty()) null
        else "${st.findIndex + 1}/${st.findMatches.size}"

    private fun computeMatches(content: String, query: String): List<Int> {
        if (query.isEmpty() || content.isEmpty()) return emptyList()
        val result = mutableListOf<Int>()
        var idx = content.indexOf(query)
        while (idx >= 0 && result.size < 500) {
            result.add(idx)
            idx = content.indexOf(query, idx + query.length)
        }
        return result
    }

    // ---------- Git（v0.3） ----------

    /** 刷新当前项目的 Git 状态 */
    fun refreshGitStatus() {
        val dir = currentProject ?: return
        viewModelScope.launch {
            _ui.update { it.copy(gitBusy = true) }
            val status = withContext(Dispatchers.IO) { git.status(dir) }
            _ui.update { it.copy(gitBusy = false, gitStatus = status) }
        }
    }

    fun gitInit() {
        val dir = currentProject ?: return
        val s = _ui.value.settings
        viewModelScope.launch {
            _ui.update { it.copy(gitBusy = true) }
            val result = withContext(Dispatchers.IO) {
                git.init(
                    dir,
                    s.gitUserName.ifBlank { "CodePocket" },
                    s.gitUserEmail.ifBlank { "dev@terminal.local" }
                )
            }
            _ui.update { it.copy(gitBusy = false, gitLastResult = result) }
            refreshGitStatus()
        }
    }

    fun gitCommit(message: String) {
        val dir = currentProject ?: return
        val s = _ui.value.settings
        viewModelScope.launch {
            _ui.update { it.copy(gitBusy = true) }
            val result = withContext(Dispatchers.IO) {
                git.commitAll(dir, message, s.gitUserName.ifBlank { "CodePocket" },
                    s.gitUserEmail.ifBlank { "dev@terminal.local" })
            }
            _ui.update { it.copy(gitBusy = false, gitLastResult = result) }
            refreshGitStatus()
        }
    }

    fun gitPush() {
        val dir = currentProject ?: return
        viewModelScope.launch {
            _ui.update { it.copy(gitBusy = true) }
            val result = withContext(Dispatchers.IO) { git.push(dir, _ui.value.settings.gitRemoteUrl) }
            _ui.update { it.copy(gitBusy = false, gitLastResult = result) }
        }
    }

    fun gitPull() {
        val dir = currentProject ?: return
        viewModelScope.launch {
            _ui.update { it.copy(gitBusy = true) }
            val result = withContext(Dispatchers.IO) { git.pull(dir, _ui.value.settings.gitRemoteUrl) }
            _ui.update { it.copy(gitBusy = false, gitLastResult = result) }
            refreshTree()
        }
    }

    fun onGitConfigChanged(name: String, email: String, remote: String) {
        val s = _ui.value.settings
        updateSettings(s.copy(gitUserName = name, gitUserEmail = email, gitRemoteUrl = remote))
        _ui.update { it.copy(gitLastResult = "Git 配置已保存") }
    }

    // ---------- AI 助手（v0.3） ----------

    fun onAiInputChanged(text: String) {
        _ui.update { it.copy(aiInputDraft = text) }
    }

    /** 发送输入框里的自由提问 */
    fun sendAiInput() {
        val text = _ui.value.aiInputDraft.trim()
        if (text.isNotBlank()) {
            _ui.update { it.copy(aiInputDraft = "") }
            askAi(text)
        }
    }

    /** 快捷动作：解释文件 / 修复报错 / 生成测试 / 加注释 */
    fun aiQuick(label: String) {
        val st = _ui.value
        val prompt = when (label) {
            "解释此文件" -> "解释当前文件的代码逻辑，要点式回答"
            "修复运行错误" -> {
                val errs = AiClient.errorContext(st.output)
                if (errs.isBlank()) {
                    _ui.update { it.copy(message = "还没有运行输出，先跑一次再修",
                        messageSeq = it.messageSeq + 1) }
                    return
                }
                "这是最近一次运行的报错输出，帮我定位原因并修复当前文件中的问题：\n$errs"
            }
            "生成测试" -> "为当前文件的核心函数生成单元测试代码（Python 用 unittest，Java 用 JUnit）"
            "加注释" -> "给当前文件里的每个函数加上中文文档注释，返回完整代码"
            else -> label
        }
        askAi(prompt)
    }

    /**
     * 发起 AI 对话。
     * 上下文 = 系统提示词 + 近 6 条历史 + 当前文件内容（截断）+ 本轮请求。
     */
    private fun askAi(prompt: String) {
        val st = _ui.value
        if (!st.settings.aiConfigured) {
            _ui.update { it.copy(message = "请先在设置里配置 AI 端点", messageSeq = it.messageSeq + 1) }
            return
        }
        if (st.aiBusy) return
        aiCancelRequested = false
        val history = st.aiMessages
        val fileContext = if (st.currentFile != null)
            "【当前文件 ${st.currentFile.name}】\n${st.editorText.take(3500)}\n\n【用户请求】\n$prompt"
        else prompt
        _ui.update {
            it.copy(aiBusy = true, aiMessages = history + AiClient.ChatMessage("user", prompt))
        }
        aiJob = viewModelScope.launch {
            // P2-2：改流式输出——先放一个空 assistant 气泡，逐段 append，不再阻塞等整段返回。
            _ui.update { it.copy(aiMessages = it.aiMessages + AiClient.ChatMessage("assistant", "")) }
            val aiClient = AiClient(_ui.value.settings)
            val sb = StringBuilder()
            runCatching {
                withTimeout(180_000L) {
                aiClient.chatStream(AiClient.SYSTEM_PROMPT, history.takeLast(6), fileContext)
                    .collect { chunk ->
                        sb.append(chunk)
                        _ui.update { st ->
                            st.copy(aiMessages = st.aiMessages.withLast(
                                AiClient.ChatMessage("assistant", sb.toString())
                            ))
                        }
                    }
                }
            }.onFailure { e ->
                // 用户主动取消不算错误；其余失败保留已收到的部分并追加提示
                if (e !is CancellationException && sb.isEmpty()) {
                    sb.append("⚠️ ${e.message ?: "请求失败"}")
                }
            }
            val finalText = when {
                sb.isNotEmpty() -> sb.toString()
                aiCancelRequested -> "（已取消）"
                else -> "（无响应）"
            }
            _ui.update { st ->
                st.copy(
                    aiBusy = false,
                    aiMessages = st.aiMessages.withLast(AiClient.ChatMessage("assistant", finalText))
                )
            }
            aiJob = null
        }
    }

    /** 用户主动停止流式回复；底层 Socket 由 Flow 的 awaitClose 断开 */
    fun cancelAi() {
        aiCancelRequested = true
        aiJob?.cancel()
    }

    /** 替换 aiMessages 列表的最后一条（流式追加用）；空列表原样返回 */
    private fun List<AiClient.ChatMessage>.withLast(m: AiClient.ChatMessage): List<AiClient.ChatMessage> =
        if (isEmpty()) this else dropLast(1) + m

    // ---------- Agent（v0.4） ----------

    fun onAgentInputChanged(text: String) {
        _ui.update { it.copy(agentInputDraft = text) }
    }

    fun sendAgentInput() {
        val text = _ui.value.agentInputDraft.trim()
        if (text.isNotEmpty()) {
            _ui.update { it.copy(agentInputDraft = "") }
            startAgentTask(text)
        }
    }

    fun approveAgentPatch() {
        agentApproval?.complete(true)
        _ui.update { it.copy(agentPendingCall = null, agentPendingProposal = null) }
    }

    fun rejectAgentPatch() {
        agentApproval?.complete(false)
        _ui.update { it.copy(agentPendingCall = null, agentPendingProposal = null) }
    }

    fun cancelAgent() {
        agentApproval?.complete(false)
        agentApproval = null
        agentJob?.cancel()
        agentJob = null
        _ui.update {
            it.copy(
                agentBusy = false,
                agentPendingCall = null,
                agentPendingProposal = null,
            )
        }
    }

    fun restoreAgentCheckpoint() {
        val st = _ui.value
        val store = activeCheckpointStore
        val projectDir = currentProject
        val events = st.agentCheckpoints.ifEmpty { listOfNotNull(st.lastAgentCheckpoint) }
        if (events.isEmpty() || store == null || projectDir == null) {
            _ui.update { it.copy(message = "没有可恢复的 Agent 检查点", messageSeq = it.messageSeq + 1) }
            return
        }
        viewModelScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val all = store.list().associateBy { it.id }
                    val restored = LinkedHashSet<String>()
                    var failure: String? = null
                    for (event in events.reversed()) {
                        val checkpoint = all[event.checkpointId]
                        if (checkpoint == null) {
                            failure = "检查点不存在：${event.checkpointId}"
                            break
                        }
                        runCatching { store.restore(checkpoint) }
                            .onSuccess { restored.addAll(checkpoint.files) }
                            .onFailure { failure = it.message ?: "检查点恢复失败" }
                        if (failure != null) break
                    }
                    if (failure != null) error(failure) else restored.toList()
                }
            }
            result.onSuccess { files ->
                reloadAfterAgent(files, projectDir)
                _ui.update {
                    it.copy(
                        lastAgentCheckpoint = null,
                        agentCheckpoints = emptyList(),
                        message = "已撤销本次 Agent 修改（${files.size} 个文件）",
                        messageSeq = it.messageSeq + 1,
                    )
                }
            }.onFailure { e ->
                _ui.update {
                    it.copy(
                        message = "恢复失败：${e.message}",
                        messageSeq = it.messageSeq + 1,
                    )
                }
            }
        }
    }

    private fun startAgentTask(task: String) {
        val st = _ui.value
        if (!st.settings.aiConfigured) {
            _ui.update {
                it.copy(message = "请先在设置里配置 AI 端点", messageSeq = it.messageSeq + 1)
            }
            return
        }
        val projectDir = currentProject
        if (projectDir == null) {
            _ui.update {
                it.copy(message = "先打开一个项目", messageSeq = it.messageSeq + 1)
            }
            return
        }
        if (st.agentBusy) return
        if (st.running) {
            _ui.update { it.copy(message = "先停止正在运行的程序", messageSeq = it.messageSeq + 1) }
            return
        }
        if (st.dirty) {
            _ui.update {
                it.copy(message = "先保存当前文件，再让 Agent 修改", messageSeq = it.messageSeq + 1)
            }
            return
        }

        val workspace = runCatching { LocalWorkspace(projectDir) }.getOrElse { e ->
            _ui.update {
                it.copy(message = "无法打开工作区：${e.message}", messageSeq = it.messageSeq + 1)
            }
            return
        }
        val checkpoints = CheckpointStore(File(context.filesDir, "agent-checkpoints"), workspace)
        val provider = OpenAiCompatibleProvider(st.settings)
        val runner = runtimes?.let { EngineCommandRunner(context, it, projectDir) }
        val tools = ToolRegistry(
            listOf(
                ReadFileTool(), ListFilesTool(), SearchTextTool(), ApplyPatchTool(),
                RunFileTool(runner), RunTestsTool(runner),
            )
        )
        val loop = AgentLoop(
            workspace = workspace,
            tools = tools,
            provider = provider,
            checkpoints = checkpoints,
            approve = ApprovalHandler { call ->
                val deferred = CompletableDeferred<Boolean>()
                agentApproval = deferred
                _ui.update { it.copy(agentPendingCall = call) }
                deferred.await()
            },
        )

        activeCheckpointStore = checkpoints
        _ui.update {
            it.copy(
                agentBusy = true,
                agentEvents = emptyList(),
                agentPendingCall = null,
                agentPendingProposal = null,
                lastAgentCheckpoint = null,
                agentCheckpoints = emptyList(),
            )
        }
        agentJob = viewModelScope.launch {
            try {
                loop.run(task) { event ->
                    if (event is AgentEvent.PatchProposed) {
                        _ui.update { it.copy(agentPendingProposal = event) }
                    }
                    if (event is AgentEvent.Checkpoint) {
                        _ui.update {
                            it.copy(
                                lastAgentCheckpoint = event,
                                agentCheckpoints = it.agentCheckpoints + event,
                            )
                        }
                    }
                    _ui.update {
                        it.copy(agentEvents = (it.agentEvents + event).takeLast(200))
                    }
                    when (event) {
                        is AgentEvent.Approval -> _ui.update {
                            it.copy(agentPendingCall = null, agentPendingProposal = null)
                        }
                        is AgentEvent.PatchApplied -> {
                            _ui.update {
                                it.copy(agentPendingCall = null, agentPendingProposal = null)
                            }
                            reloadAfterAgent(event.paths, projectDir)
                        }
                        is AgentEvent.SessionFinished, is AgentEvent.Failure -> _ui.update {
                            it.copy(agentPendingCall = null, agentPendingProposal = null)
                        }
                        else -> Unit
                    }
                }
            } finally {
                agentApproval?.complete(false)
                agentApproval = null
                _ui.update {
                    it.copy(
                        agentBusy = false,
                        agentPendingCall = null,
                        agentPendingProposal = null,
                    )
                }
                agentJob = null
            }
        }
    }

    private fun reloadAfterAgent(paths: List<String>, projectDir: File) {
        val file = _ui.value.currentFile
        if (file != null) {
            val relative = runCatching {
                file.relativeTo(projectDir).path.replace(File.separatorChar, '/')
            }.getOrNull()
            if (relative != null && relative in paths) {
                viewModelScope.launch {
                    val text = withContext(Dispatchers.IO) {
                        runCatching { file.readText() }.getOrNull()
                    }
                    if (text != null) {
                        _ui.update { it.copy(editorText = text, dirty = false) }
                    }
                    refreshTree()
                }
            } else {
                refreshTree()
            }
        } else {
            refreshTree()
        }
    }

    // ---------- 全局搜索（v0.3） ----------

    /**
     * 跨文件搜索：遍历项目内文本文件，收集命中行（上限 200 条防卡顿）。
     * 跳过隐藏目录与构建产物——否则一次搜索能把 .git 翻个底朝天。
     */
    fun searchAll(query: String) {
        val dir = currentProject ?: return
        if (query.isBlank()) return
        viewModelScope.launch {
            _ui.update { it.copy(globalSearching = true) }
            val hits = withContext(Dispatchers.IO) {
                val result = mutableListOf<SearchHit>()
                dir.walkTopDown()
                    .onEnter { !it.name.startsWith(".") && it.name !in WALK_EXCLUDED }
                    .filter { it.isFile && it.extension in SEARCHABLE_EXT && it.length() < 512 * 1024 }
                    .forEach { f ->
                        if (result.size >= 200) return@forEach
                        runCatching {
                            f.readText().lines().forEachIndexed { idx, line ->
                                if (result.size < 200 && line.contains(query, ignoreCase = true)) {
                                    result.add(
                                        SearchHit(f.absolutePath, f.name, idx + 1, line.trim().take(120))
                                    )
                                }
                            }
                        }
                    }
                result
            }
            _ui.update { it.copy(globalSearching = false, globalResults = hits) }
        }
    }

    /** 从全局搜索结果打开对应文件 */
    fun openSearchHit(hit: SearchHit) {
        openFile(File(hit.filePath))
    }

    // ---------- 文件 / 项目管理（补全） ----------

    /** 列出所有项目（供项目切换对话框使用） */
    fun listProjects(): List<File> = projects.listProjects()

    /** 删除项目（当前项目不可删，由 UI 层拦截） */
    fun deleteProject(dir: File) {
        viewModelScope.launch(Dispatchers.IO) {
            projects.deleteProject(dir)
            _ui.update { it.copy(message = "已删除项目 ${dir.name}", messageSeq = it.messageSeq + 1) }
        }
    }

    /** 在当前项目根目录新建文件并打开 */
    fun newFileInCurrentDir(name: String) {
        val dir = currentProject ?: return
        viewModelScope.launch {
            val f = withContext(Dispatchers.IO) { projects.createFile(dir.absolutePath, name) }
            refreshTree()
            openFile(f)
        }
    }

    /** 在当前项目根目录新建文件夹 */
    fun newFolderInCurrentDir(name: String) {
        val dir = currentProject ?: return
        viewModelScope.launch {
            withContext(Dispatchers.IO) { projects.createDirectory(dir.absolutePath, name) }
            refreshTree()
            _ui.update { it.copy(message = "已创建文件夹 $name", messageSeq = it.messageSeq + 1) }
        }
    }

    /** 把输出面板全部内容复制到剪贴板 */
    fun copyOutput() {
        val text = _ui.value.output.joinToString("\n")
        val cm = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE)
                as android.content.ClipboardManager
        cm.setPrimaryClip(android.content.ClipData.newPlainText("output", text))
        _ui.update { it.copy(message = "已复制输出", messageSeq = it.messageSeq + 1) }
    }

    /** 跳转到指定行（用户输入 1 基行号） */
    fun gotoLine(line: Int) {
        _ui.update {
            val seq = (it.gotoLineRequest?.seq ?: 0L) + 1
            it.copy(gotoLineRequest = ScrollToLineRequest((line - 1).coerceAtLeast(0), seq))
        }
    }

    // ---------- 导入 / 导出（SAF） ----------

    /**
     * 把用户通过 SAF 选中的文件导入到当前项目。
     * 同名文件自动加序号，不静默覆盖用户已有内容。
     * @param uri SAF 返回的内容 URI
     */
    fun importFile(uri: android.net.Uri) {
        val dir = currentProject ?: run {
            _ui.update { it.copy(message = "没有打开的项目", messageSeq = it.messageSeq + 1) }
            return
        }
        viewModelScope.launch {
            val name = withContext(Dispatchers.IO) {
                runCatching {
                    val resolver = context.contentResolver
                    // 从 URI 推断原始文件名
                    val raw = queryDisplayName(uri) ?: "imported_${System.currentTimeMillis()}.txt"
                    // SAF provider 的 display name 不可信：可能是 ../../shared_prefs/...
                    // 先按文件名规则清洗，再校验 canonical 路径必须落在当前项目内。
                    val safeName = sanitizeFileName(raw)
                    val target = uniqueTarget(dir, safeName)
                    require(target.canonicalFile.parentFile == dir.canonicalFile) {
                        "导入目标越界"
                    }
                    resolver.openInputStream(uri)?.use { input ->
                        target.outputStream().use { output -> input.copyTo(output) }
                    } ?: throw IllegalStateException("无法读取所选文件")
                    target.name
                }.getOrElse { e ->
                    _ui.update { it.copy(message = "导入失败：${e.message}", messageSeq = it.messageSeq + 1) }
                    return@withContext null
                }
            }
            if (name != null) {
                refreshTree()
                // 自动打开刚导入的文件
                File(dir, name).takeIf { it.exists() }?.let { openFile(it) }
                _ui.update { it.copy(message = "已导入 $name", messageSeq = it.messageSeq + 1) }
            }
        }
    }

    /** 目标文件已存在时追加 -1、-2… 直到不冲突 */
    private fun uniqueTarget(dir: File, name: String): File {
        var candidate = File(dir, name)
        if (!candidate.exists()) return candidate
        val dot = name.lastIndexOf('.')
        val base = if (dot > 0) name.substring(0, dot) else name
        val ext = if (dot > 0) name.substring(dot) else ""
        var i = 1
        while (candidate.exists() && i < 999) {
            candidate = File(dir, "$base-$i$ext")
            i++
        }
        return candidate
    }

    /**
     * 把当前文件内容写入用户通过 SAF 选择的目标位置。
     * @param uri 用户选择的目标文件 URI
     */
    fun exportCurrentFile(uri: android.net.Uri) {
        val st = _ui.value
        val file = st.currentFile ?: run {
            _ui.update { it.copy(message = "没有打开的文件", messageSeq = it.messageSeq + 1) }
            return
        }
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                runCatching {
                    // 先落盘，保证导出的是最新内容
                    if (st.dirty) projects.write(file.absolutePath, st.editorText)
                    context.contentResolver.openOutputStream(uri)?.use { output ->
                        output.write(st.editorText.toByteArray(Charsets.UTF_8))
                    } ?: throw IllegalStateException("无法写入目标位置")
                }
            }.onSuccess {
                _ui.update { it.copy(dirty = false, message = "已导出 ${file.name}",
                    messageSeq = it.messageSeq + 1) }
            }.onFailure { e ->
                _ui.update { it.copy(message = "导出失败：${e.message}", messageSeq = it.messageSeq + 1) }
            }
        }
    }

    /** 从 SAF 的 content URI 查询显示文件名 */
    private fun queryDisplayName(uri: android.net.Uri): String? = runCatching {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val idx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && cursor.moveToFirst()) cursor.getString(idx) else null
        }
    }.getOrNull()

    /** 导出的默认文件名（供 UI 预填） */
    fun suggestedExportName(): String =
        _ui.value.currentFile?.name ?: "untitled.py"

    // ---------- 语言识别 ----------

    /** 当前文件是否可运行（由 LanguageRegistry + RuntimeRegistry 决定） */
    fun canRun(file: File?): Boolean {
        val spec = LanguageRegistry.forFile(file)
        return spec.isRunnable && runtimes?.isAvailable(spec.id) == true
    }


    private companion object {
        val SEARCHABLE_EXT = LanguageRegistry.searchableExtensions
    }
}
