package com.devterminal.ui

import android.Manifest
import android.content.Intent
import android.os.Build
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.automirrored.outlined.MenuOpen
import androidx.compose.material.icons.filled.AccountTree
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.CreateNewFolder
import androidx.compose.material.icons.filled.FileDownload
import androidx.compose.material.icons.filled.FileUpload
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.NoteAdd
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Redo
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.outlined.HealthAndSafety
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Folder
import androidx.compose.material.icons.outlined.LibraryBooks
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.NavigateBefore
import androidx.compose.material.icons.outlined.Preview
import androidx.compose.material.icons.outlined.Terminal
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.mapSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.devterminal.BuildConfig
import com.devterminal.engine.LanguageRegistry
import com.devterminal.project.Templates
import com.devterminal.ui.components.ActionTile
import com.devterminal.ui.components.rememberHaptics
import com.devterminal.ui.components.Hairline
import com.devterminal.ui.components.MonoText
import com.devterminal.ui.components.QuietHint
import com.devterminal.ui.components.QuietIconButton
import com.devterminal.ui.components.SectionLabel
import com.devterminal.ui.theme.Dimens
import com.devterminal.ui.theme.Motion
import com.devterminal.ui.theme.effectiveDarkTheme
import com.devterminal.ui.theme.faint
import com.devterminal.ui.theme.hairline
import com.devterminal.ui.theme.muted
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.io.File
import kotlin.math.roundToInt

/**
 * 主界面。
 *
 * 重构思路（简洁唯美主义）：
 *  - **顶栏只留三个动作**：菜单、命令面板、运行/停止（保存仅在未保存时出现）。
 *    原先塞了 6 个图标，在未保存时更是挤到 7 个，小屏上彼此只剩几像素间距。
 *    其余动作全部收进 ⌘K 命令面板——它们的入口没消失，只是不再抢位置。
 *  - **抽屉底部从三行文字按钮改为九宫格图标入口**，扫描效率更高也更整齐。
 *  - 全站不再出现实心色块徽标，状态一律用「色点 + 细字」表达。
 */
/**
 * Overlay 的 Saver：密封类没有默认可保存器，这里按「名称 → 实例」映射落盘，
 * FileAction 单独携带 path。横竖屏切换 / 进程重建后，打开的面板不会凭空消失。
 */
private val overlaySaver = run {
    data class Named(val key: String, val overlay: Overlay)
    val objects = listOf(
        Named("none", Overlay.None),
        Named("palette", Overlay.Palette),
        Named("newProject", Overlay.NewProject),
        Named("git", Overlay.Git),
        Named("ai", Overlay.Ai),
        Named("agent", Overlay.Agent),
        Named("globalSearch", Overlay.GlobalSearch),
        Named("symbols", Overlay.Symbols),
        Named("localModels", Overlay.LocalModels),
        Named("agentHistory", Overlay.AgentHistory),
        Named("terminal", Overlay.Terminal),
        Named("diagnostics", Overlay.Diagnostics),
        Named("runConfig", Overlay.RunConfig),
        Named("settings", Overlay.Settings),
        Named("about", Overlay.About),
        Named("onboarding", Overlay.Onboarding),
    )
    mapSaver(
        save = { o ->
            when (o) {
                is Overlay.FileAction -> mapOf("kind" to "fileAction", "path" to o.path)
                else -> mapOf("kind" to (objects.firstOrNull { it.overlay == o }?.key ?: "none"))
            }
        },
        restore = { m ->
            if (m["kind"] == "fileAction") {
                Overlay.FileAction(m["path"] as? String ?: "")
            } else {
                objects.firstOrNull { it.key == m["kind"] }?.overlay ?: Overlay.None
            }
        }
    )
}

/** ScrollToLineRequest 的 Saver：落盘 [line, seq]，恢复后再跳一次目标行 */
private val scrollToLineSaver = run {
    listSaver<ScrollToLineRequest?, Any>(
        save = { req -> req?.let { listOf<Any>(it.line, it.seq) } ?: emptyList<Any>() },
        restore = { parts ->
            if (parts.isEmpty()) null
            else ScrollToLineRequest(
                (parts[0] as Number).toInt(),
                (parts[1] as Number).toLong()
            )
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditorScreen(vm: EditorViewModel) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val currentSpec = LanguageRegistry.forFile(ui.currentFile)
    val cs = MaterialTheme.colorScheme
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }
    val context = LocalContext.current

    // 同一时刻至多一个面板。原先这里是 9 个独立布尔值，
    // 既可以同时为 true（弹窗叠弹窗），也容易漏掉打开时的副作用。
    // rememberSaveable：横竖屏切换后保持当前打开的面板（自定义 Saver 落盘）。
    var overlay by rememberSaveable(stateSaver = overlaySaver) {
        mutableStateOf<Overlay>(Overlay.None)
    }
    fun closeOverlay() { overlay = Overlay.None }

    // 预览防抖：分屏打开期间，编辑文本停止变化 350ms 后才真正重渲染，
    // 敲每个字都重新生成 HTML 会又卡又闪。collectLatest 保证连续输入只落最后一次。
    LaunchedEffect(ui.previewVisible, ui.currentFile?.path) {
        if (!ui.previewVisible) return@LaunchedEffect
        vm.renderPreview()  // 打开/切文件时立即渲染一次
        snapshotFlow { ui.editorText }
            .collectLatest { delay(350); vm.renderPreview() }
    }

    /** 跳转到报错行的请求（seq 自增保证连续点同一行也能响应）；rememberSaveable 跨屏保留 */
    var scrollToLine by rememberSaveable(stateSaver = scrollToLineSaver) {
        mutableStateOf<ScrollToLineRequest?>(null)
    }

    /** 全局搜索关键词；rememberSaveable 让横竖屏切换不丢已输入的查询词 */
    var gsearchQuery by rememberSaveable { mutableStateOf("") }

    // SAF：导入任意文件到项目
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> uri?.let { vm.importFile(it) } }

    // SAF：把当前文件导出到用户选择的位置
    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("text/plain")
    ) { uri -> uri?.let { vm.exportCurrentFile(it) } }

    // Android 13+ 通知权限：先给一句说明（Snackbar +「允许」），用户点允许才弹系统权限框。
    // 用独立 SharedPreferences 记「已问过」，不与加密改造中的 SettingsStore 冲突。
    val notifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* 无论授予与否都不再追问 */ }
    val uiPrefs = remember {
        context.getSharedPreferences("devterminal_ui", android.content.Context.MODE_PRIVATE)
    }
    LaunchedEffect(ui.envState) {
        if (ui.envState == EnvState.READY && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && !uiPrefs.getBoolean("notif_asked", false)
        ) {
            uiPrefs.edit().putBoolean("notif_asked", true).apply()
            val r = snackbar.showSnackbar(
                message = "允许通知，才能在后台保持代码运行",
                actionLabel = "允许",
                duration = SnackbarDuration.Long
            )
            if (r == SnackbarResult.ActionPerformed) {
                notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    // 首次进入且环境就绪时，先给一次「这是什么 / 从哪开始」的说明；
    // 只在第一次出现，后续可通过抽屉「指南」或命令面板再次打开。
    LaunchedEffect(ui.envState) {
        if (ui.envState == EnvState.READY && overlay == Overlay.None &&
            !uiPrefs.getBoolean("onboarding_seen", false)
        ) {
            overlay = Overlay.Onboarding
        }
    }

    // 以提示序号为 key：内容相同的两条消息也能各弹一次
    LaunchedEffect(ui.messageSeq) {
        ui.message?.let {
            snackbar.showSnackbar(it)
            vm.consumeMessage()
        }
    }

    // 运行结束时给一次触觉反馈。
    // 用户点完「运行」后视线通常还停在编辑器上，不会盯着底部输出面板；
    // 一次轻震动就把「跑完了 / 挂了」传达到位，省掉一次低头。
    val haptics = rememberHaptics()
    LaunchedEffect(ui.running, ui.exitCode) {
        if (!ui.running && ui.exitCode != null) {
            if (ui.exitCode == 0) haptics.success() else haptics.failure()
        }
    }

    // P3-17：会话恢复后，ViewModel 下发的光标定位请求 → 转成编辑器 scrollToLine
    LaunchedEffect(ui.restoreCursorSeq) {
        if (ui.restoreCursorSeq > 0) {
            scrollToLine = ScrollToLineRequest(
                line = ui.restoreCursorLine,
                seq = ui.restoreCursorSeq,
                col = ui.restoreCursorCol
            )
        }
    }

    // 切后台 / 系统回收前自动保存：任何已发布编辑器的数据安全底线
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_STOP) vm.saveOnBackground()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // 返回键：按「由内到外」的顺序逐层关闭——
    // 先收查找条，再收抽屉，最后才是退出 App。环境准备期间吞掉返回，
    // 避免解压到一半退出；工具链缺失页则允许返回退出，别把用户困住。
    BackHandler(
        enabled = ui.findVisible || drawerState.isOpen || overlay != Overlay.None
            || ui.envState == EnvState.PREPARING
    ) {
        when {
            ui.findVisible -> vm.showFind(false)
            drawerState.isOpen -> scope.launch { drawerState.close() }
            overlay == Overlay.Onboarding -> {
                uiPrefs.edit().putBoolean("onboarding_seen", true).apply()
                closeOverlay()
            }
            overlay != Overlay.None -> closeOverlay()
            // PREPARING：什么都不做，吞掉返回，避免解压到一半退出
        }
    }

    // 环境准备中：全屏进度
    if (ui.envState == EnvState.PREPARING) {
        PreparingScreen(message = ui.envMessage, progress = ui.installProgress)
        return
    }

    // 工具链缺失：引导页，告诉用户该怎么修
    if (ui.envState == EnvState.ERROR && ui.diagnostics == null) {
        MissingToolchainScreen(
            message = ui.envMessage,
            detail = ui.message,
            onRetry = { vm.retryPrepare() }
        )
        return
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.width(272.dp),
                drawerContainerColor = cs.surface
            ) {
                Column(Modifier.fillMaxHeight()) {
                    // ---------- 品牌区 ----------
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(start = Dimens.lg, end = Dimens.sm, top = Dimens.xl, bottom = Dimens.md),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Outlined.Terminal, null,
                            tint = cs.primary, modifier = Modifier.size(20.dp)
                        )
                        Spacer(Modifier.width(Dimens.sm))
                        Column(Modifier.weight(1f)) {
                            Text(
                                "CodePocket",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
                            )
                            MonoText("v${BuildConfig.VERSION_NAME} · 完全离线",
                                color = cs.faint, fontSize = 9)
                        }
                        QuietIconButton(
                            Icons.AutoMirrored.Outlined.MenuOpen, "收起侧栏",
                            onClick = { scope.launch { drawerState.close() } }
                        )
                    }
                    Hairline()

                    // ---------- 文件树 ----------
                    FileTree(
                        root = ui.tree,
                        selectedPath = ui.currentFile?.absolutePath,
                        onFileClick = { vm.openFile(File(it.path)) },
                        onFileLongPress = { node -> overlay = Overlay.FileAction(node.path) },
                        onNewFile = { overlay = Overlay.NewFile },
                        onNewFolder = { overlay = Overlay.NewFolder },
                        // P2-7：git 变更映射成 path→状态码喂给文件树
                        gitStatus = ui.gitStatus?.changes
                            ?.associate { it.path to it.statusCode }.orEmpty(),
                        modifier = Modifier.weight(1f)
                    )

                    Hairline()
                    // ---------- 动作九宫格 ----------
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = Dimens.md, vertical = Dimens.md)
                    ) {
                        SectionLabel("快捷动作")
                        Spacer(Modifier.height(Dimens.sm))
                        Row(horizontalArrangement = Arrangement.spacedBy(Dimens.sm)) {
                            ActionTile(Icons.Outlined.Folder, "项目",
                                onClick = { overlay = Overlay.SwitchProject },
                                modifier = Modifier.weight(1f))
                            ActionTile(Icons.Filled.FileDownload, "导入",
                                onClick = { importLauncher.launch(arrayOf("*/*")) },
                                modifier = Modifier.weight(1f))
                            ActionTile(Icons.Filled.FileUpload, "导出",
                                onClick = { exportLauncher.launch(vm.suggestedExportName()) },
                                enabled = ui.currentFile != null,
                                modifier = Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(Dimens.sm))
                        Row(horizontalArrangement = Arrangement.spacedBy(Dimens.sm)) {
                            ActionTile(Icons.Filled.AccountTree, "Git",
                                onClick = { overlay = Overlay.Git; vm.refreshGitStatus() },
                                modifier = Modifier.weight(1f))
                            ActionTile(Icons.Filled.AutoAwesome, "AI",
                                onClick = { overlay = Overlay.Ai },
                                accent = cs.secondary,
                                modifier = Modifier.weight(1f))
                            ActionTile(Icons.Filled.Search, "搜索",
                                onClick = { overlay = Overlay.GlobalSearch },
                                modifier = Modifier.weight(1f))
                        }
                        Spacer(Modifier.height(Dimens.sm))
                        Row(horizontalArrangement = Arrangement.spacedBy(Dimens.sm)) {
                            ActionTile(Icons.Outlined.HealthAndSafety, "自检",
                                onClick = { overlay = Overlay.Diagnostics },
                                modifier = Modifier.weight(1f))
                            ActionTile(Icons.Filled.Settings, "设置",
                                onClick = { overlay = Overlay.Settings },
                                modifier = Modifier.weight(1f))
                            ActionTile(Icons.Outlined.LibraryBooks, "指南",
                                onClick = { overlay = Overlay.Onboarding },
                                modifier = Modifier.weight(1f))
                            ActionTile(Icons.Outlined.Info, "关于",
                                onClick = { overlay = Overlay.About },
                                modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            MonoText(
                                ui.currentFile?.name ?: "未打开文件",
                                color = if (ui.currentFile != null) cs.onSurface else cs.faint,
                                fontSize = 13
                            )
                            if (ui.dirty) {
                                Spacer(Modifier.width(6.dp))
                                Box(
                                    Modifier
                                        .size(6.dp)
                                        .background(cs.secondary, androidx.compose.foundation.shape.CircleShape)
                                )
                            }
                            if (ui.currentFile != null) {
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    currentSpec.displayName,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = cs.muted
                                )
                                if (!currentSpec.isRunnable) {
                                    Spacer(Modifier.width(4.dp))
                                    Text(
                                        "仅编辑",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = cs.faint
                                    )
                                }
                            }
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Outlined.Menu, "打开文件树", tint = cs.muted)
                        }
                    },
                    actions = {
                        // 预览开关：只有 Markdown / HTML 文件出现
                        if (vm.isPreviewable(ui.currentFile)) {
                            QuietIconButton(
                                Icons.Outlined.Preview, "实时预览",
                                onClick = { vm.togglePreview() },
                                tint = if (ui.previewVisible) cs.primary else cs.muted
                            )
                        }
                        // 命令面板：其余动作的归处，保持顶栏清爽
                        QuietIconButton(
                            Icons.Outlined.Terminal, "命令面板",
                            onClick = { overlay = Overlay.Palette }
                        )
                        if (ui.dirty) {
                            QuietIconButton(
                                Icons.Filled.Save, "保存",
                                onClick = { vm.save() }, tint = cs.primary
                            )
                        }
                        if (ui.running) {
                            QuietIconButton(
                                Icons.Filled.Stop, "停止",
                                onClick = { vm.stopRun() }, tint = cs.error
                            )
                        } else {
                            val canRun = vm.canRun(ui.currentFile)
                            QuietIconButton(
                                Icons.Filled.PlayArrow, "运行",
                                onClick = { vm.runCurrent() },
                                enabled = canRun,
                                tint = if (canRun) cs.primary else cs.faint,
                                size = 24.dp
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = cs.surface,
                        scrolledContainerColor = cs.surface
                    )
                )
            },
            snackbarHost = { SnackbarHost(snackbar) },
            containerColor = cs.background
        ) { padding ->
            // 输出面板高度：初始值来自设置，拖拽即时调整，松手才落盘
            var outputHeight by remember(ui.settings.outputHeightDp) {
                mutableStateOf(ui.settings.outputHeightDp.toFloat())
            }
            BoxWithConstraints(Modifier.padding(padding).fillMaxSize()) {
            // 当前可用高度（已扣除顶栏与系统栏）。用于给输出面板动态设上限：
            // 横屏 / 小屏上固定上限会让面板吃掉整个编辑器。
            val availableHeight = maxHeight.value
            // 换屏后旧高度可能已超过新上限，这里夹一次，避免布局瞬间被撑爆
            LaunchedEffect(availableHeight) {
                val cap = (availableHeight * 0.62f).coerceAtLeast(120f)
                if (outputHeight > cap) {
                    outputHeight = cap
                    vm.persistOutputHeight(cap.roundToInt())
                }
            }
            // ---- 横竖屏共用同一份内容、只是摆放不同 ----
            // 内容抽成局部 Composable（捕获 ui/vm 等闭包变量），避免两份拷贝日后走样。
            // 横屏下编辑器与输出面板左右分栏：横屏最缺的是纵向空间，
            // 继续上下排布会把编辑器挤到看不见代码（设计稿 grid 方案已验证过两栏收益）。
            val isLandscape = maxWidth > maxHeight

            val envBanner: @Composable ColumnScope.() -> Unit = {
                if (ui.envState == EnvState.ERROR) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .background(cs.error.copy(alpha = 0.10f))
                            .padding(horizontal = Dimens.lg, vertical = Dimens.sm)
                    ) {
                        MonoText(ui.envMessage, color = cs.error, fontSize = 11)
                    }
                }
            }

            val editorArea: @Composable ColumnScope.() -> Unit = {
                FileTabs(
                    tabs = ui.openTabs,
                    activePath = ui.currentFile?.absolutePath,
                    onSelect = { vm.openFile(it) },
                    onClose = { vm.closeTab(it) },
                    dirtyPaths = if (ui.dirty) setOfNotNull(ui.currentFile?.absolutePath) else emptySet()
                )
                if (ui.findVisible) {
                    FindBar(
                        query = ui.findQuery,
                        replaceWith = ui.findReplaceWith,
                        matchInfo = vm.findMatchInfo(ui),
                        replaceMode = ui.findReplaceMode,
                        onQueryChange = vm::onFindQueryChanged,
                        onReplaceChange = vm::onFindReplaceChanged,
                        onNext = vm::findNext,
                        onPrev = vm::findPrev,
                        onReplaceOne = vm::replaceOne,
                        onReplaceAll = vm::replaceAll,
                        onToggleReplaceMode = vm::toggleFindReplaceMode,
                        onDismiss = { vm.showFind(false) }
                    )
                }
                if (ui.currentFile == null && !ui.findVisible) {
                    // 空态引导：告诉第一次打开的人「这是什么、现在该点哪」
                    EditorEmptyState(
                        hasProject = ui.tree != null,
                        onOpenDrawer = { scope.launch { drawerState.open() } },
                        onNewProject = { overlay = Overlay.NewProject },
                        onImport = { importLauncher.launch(arrayOf("*/*")) },
                        onGuide = { overlay = Overlay.Onboarding }
                    )
                } else if (isImageFile(ui.currentFile)) {
                    ImageFileViewer(
                        file = ui.currentFile!!,
                        modifier = Modifier.fillMaxWidth().weight(1f)
                    )
                } else {
                CodeEditorView(
                    file = ui.currentFile,
                    text = ui.editorText,
                    onTextChange = vm::onEditorChanged,
                    fontSize = ui.settings.editorFontSize,
                    language = currentSpec,
                    darkTheme = ui.settings.effectiveDarkTheme(),
                    editorTheme = ui.settings.editorTheme,
                    wordWrap = ui.settings.wordWrap,
                    autoCloseBrackets = ui.settings.autoCloseBrackets,
                    showLineNumbers = ui.settings.showLineNumbers,
                    onCursorChange = vm::onCursorChanged,
                    insertSignal = ui.insertSignal,
                    insertText = ui.insertText,
                    backspaceSignal = ui.backspaceSignal,
                    undoSignal = ui.undoSignal,
                    redoSignal = ui.redoSignal,
                    findRequest = if (ui.findVisible && ui.findMatches.isNotEmpty()) FindRequest(
                        pos = ui.findMatches.getOrNull(ui.findIndex) ?: 0,
                        length = ui.findQuery.length,
                        requestId = ui.findRequestId
                    ) else null,
                    onPinchZoom = { dir ->
                        // 双指捏合调整字号（10–24 sp），实时持久化
                        val next = (ui.settings.editorFontSize + dir).coerceIn(10, 24)
                        if (next != ui.settings.editorFontSize) {
                            vm.updateSettings(ui.settings.copy(editorFontSize = next))
                        }
                    },
                    scrollToLine = scrollToLine ?: ui.gotoLineRequest,
                    modifier = Modifier.fillMaxWidth().weight(1f)
                )
                // 实时预览分屏：与编辑器对半分（仅 .md / .html 文件可开）
                if (ui.previewVisible) {
                    PreviewPane(
                        html = ui.previewHtml,
                        darkTheme = ui.settings.effectiveDarkTheme(),
                        modifier = Modifier.fillMaxWidth().weight(1f)
                    )
                }
                // P3-16：预览分屏打开时隐藏符号栏，给左右分屏让出纵向空间；
                // 无文件打开时整个 else 分支不渲染，符号栏自然隐藏。
                if (!ui.previewVisible) {
                    SymbolBar(
                        onInsert = { vm.insertSymbol(it) },
                        onBackspace = { vm.backspaceSymbol() }
                    )
                }
                }
            }

            val outputArea: @Composable (Modifier) -> Unit = { mod ->
                OutputPanel(
                    output = ui.output,
                    running = ui.running,
                    exitCode = ui.exitCode,
                    inputVisible = ui.inputVisible,
                    inputDraft = ui.inputDraft,
                    onInputChange = vm::onInputDraftChanged,
                    onInputSend = { vm.sendInput(ui.inputDraft) },
                    onClear = vm::clearOutput,
                    onRerun = vm::runCurrent,
                    onStop = { vm.stopRun() },
                    onRequestInput = { vm.openInput() },
                    onShare = {
                        // 通过系统分享把运行结果发出去（聊天/笔记/Issue 都方便）
                        val text = ui.output.joinToString("\n")
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, text)
                        }
                        runCatching {
                            context.startActivity(Intent.createChooser(intent, "分享运行结果"))
                        }
                    },
                    onCopy = vm::copyOutput,
                    onSpecialKey = { key -> vm.sendInput(key) },
                    onJumpToLine = { line ->
                        // 报错行 → 编辑器光标。seq 自增保证连点同一行也会重新执行。
                        scrollToLine = ScrollToLineRequest(line, (scrollToLine?.seq ?: 0L) + 1L)
                    },
                    modifier = mod
                )
            }

            if (isLandscape) {
                Column(Modifier.fillMaxSize()) {
                    envBanner()
                    Row(Modifier.fillMaxWidth().weight(1f)) {
                        Column(Modifier.weight(0.64f).fillMaxHeight()) { editorArea() }
                        // 两栏之间的细分隔线，与 Hairline 同一语言
                        Box(
                            Modifier
                                .width(1.dp)
                                .fillMaxHeight()
                                .background(cs.outlineVariant)
                        )
                        Column(Modifier.weight(0.36f).fillMaxHeight()) {
                            outputArea(Modifier.fillMaxWidth().fillMaxHeight())
                        }
                    }
                    Hairline()
                    StatusBar(
                        line = ui.cursorLine,
                        column = ui.cursorColumn,
                        language = ui.languageLabel,
                        charCount = ui.editorText.length,
                        dirty = ui.dirty
                    )
                }
            } else {
            Column(Modifier.fillMaxSize()) {
                envBanner()
                editorArea()
                // 拖拽把手：一条细横线，暗示「这里可以拖动」，不加背景色
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(14.dp)
                        .background(cs.surface)
                        .pointerInput(Unit) {
                            detectVerticalDragGestures(
                                onDragEnd = { vm.persistOutputHeight(outputHeight.roundToInt()) }
                            ) { _, dragAmount ->
                                // 上限按当前可用高度动态计算，而不是写死 560dp。
                                // 矮屏（横屏 / 小屏）上固定 560dp 的上限等于没有上限——
                                // 面板会把编辑器整个挤没，用户再也看不到自己的代码。
                                val maxHeight = (availableHeight * 0.62f).coerceAtLeast(120f)
                                outputHeight = (outputHeight + dragAmount)
                                    .coerceIn(120f, maxHeight)
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        Modifier
                            .width(32.dp)
                            .height(3.dp)
                            .background(cs.outline.copy(alpha = 0.7f), RoundedCornerShape(2.dp))
                    )
                }
                outputArea(Modifier.fillMaxWidth().height(outputHeight.dp))
                Hairline()
                StatusBar(
                    line = ui.cursorLine,
                    column = ui.cursorColumn,
                    language = ui.languageLabel,
                    charCount = ui.editorText.length,
                    dirty = ui.dirty
                )
            }
            }
            }
        }
    }

    // 所有面板由单一 overlay 状态驱动：同一时刻至多一个，返回键也只需处理这一处
    if (overlay == Overlay.NewProject) {
        NewProjectDialog(
            onDismiss = ::closeOverlay,
            onCreate = { id -> vm.newProject(id); closeOverlay() }
        )
    }

    // ---------- 命令面板：所有动作的搜索入口 ----------
    if (overlay == Overlay.Palette) {
        // P2-7：最近打开的项目，按 mtime 取前 8；无项目则空列表不显示该分组
        val recent = runCatching {
            vm.recentProjects().map { dir ->
                Command("recent-${dir.absolutePath}", dir.name, dir.absolutePath,
                    Icons.Filled.Folder) { vm.openProject(java.io.File(dir.absolutePath)) }
            }
        }.getOrDefault(emptyList())
        CommandPalette(
            commands = buildCommands(vm, ui, context,
                onCommand = { cmd -> when (cmd) {
                    "terminal" -> { vm.openTerminal(); overlay = Overlay.Terminal }
                    "diag" -> overlay = Overlay.Diagnostics
                    "settings" -> overlay = Overlay.Settings
                    "about" -> overlay = Overlay.About
                    "guide" -> overlay = Overlay.Onboarding
                    "newproj" -> overlay = Overlay.NewProject
                    "git" -> { overlay = Overlay.Git; vm.refreshGitStatus() }
                    "ai" -> overlay = Overlay.Ai
                    "agent" -> overlay = Overlay.Agent
                    "gsearch" -> overlay = Overlay.GlobalSearch
                    "symbols" -> { vm.loadSymbols(); overlay = Overlay.Symbols }
                    "definition" -> if (vm.findDefinition()) overlay = Overlay.Definitions
                    "models" -> { vm.refreshLocalModels(); overlay = Overlay.LocalModels }
                    "agentHistory" -> { vm.loadAgentSessions(); overlay = Overlay.AgentHistory }
                    "runconfig" -> overlay = Overlay.RunConfig
                    "preview" -> vm.togglePreview()
                    "export" -> exportLauncher.launch(vm.suggestedExportName())
                    "goto" -> overlay = Overlay.GotoLine
                    "newfile" -> overlay = Overlay.NewFile
                    "newfolder" -> overlay = Overlay.NewFolder
                    "packages" -> overlay = Overlay.Packages
                } }
            ),
            recent = recent,
            onDismiss = ::closeOverlay
        )
    }

    if (overlay == Overlay.Git) {
        GitPanelDialog(
            status = ui.gitStatus,
            busy = ui.gitBusy,
            lastResult = ui.gitLastResult,
            gitInstalled = ui.gitInstalled,
            gitName = ui.settings.gitUserName,
            gitEmail = ui.settings.gitUserEmail,
            remoteUrl = ui.settings.gitRemoteUrl,
            onConfigChange = vm::onGitConfigChanged,
            onRefresh = vm::refreshGitStatus,
            onInit = vm::gitInit,
            onCommit = vm::gitCommit,
            onPush = vm::gitPush,
            onPull = vm::gitPull,
            onDismiss = ::closeOverlay
        )
    }

    if (overlay == Overlay.Ai) {
        AiPanelDialog(
            messages = ui.aiMessages,
            busy = ui.aiBusy,
            configured = ui.settings.aiConfigured ||
                (ui.settings.useLocalModel && ui.localModels.any {
                    it.spec.id == ui.settings.localModelId && it.installed
                }),
            inputDraft = ui.aiInputDraft,
            onInputChange = vm::onAiInputChanged,
            onSend = vm::sendAiInput,
            onQuick = vm::aiQuick,
            onCancel = vm::cancelAi,
            onInsertCode = { code ->
                // P2-3：把 AI 生成的代码块插入当前编辑器光标处
                vm.insertSymbol("\n$code\n")
                closeOverlay()
            },
            onOpenAgent = { overlay = Overlay.Agent },
            onNewChat = vm::startNewAiChat,
            onDismiss = { vm.cancelAi(); closeOverlay() }
        )
    }

    if (overlay == Overlay.Agent) {
        AgentPanelDialog(
            events = ui.agentEvents,
            busy = ui.agentBusy,
            configured = ui.settings.aiConfigured ||
                (ui.settings.useLocalModel && ui.localModels.any {
                    it.spec.id == ui.settings.localModelId && it.installed
                }),
            inputDraft = ui.agentInputDraft,
            pendingProposal = ui.agentPendingProposal,
            pendingPlan = ui.agentPendingPlan,
            planFirst = ui.settings.agentPlanFirst,
            lastCheckpoint = ui.lastAgentCheckpoint,
            checkpointCount = ui.agentCheckpoints.size,
            recovered = ui.agentRecovered,
            onInputChange = vm::onAgentInputChanged,
            onSend = vm::sendAgentInput,
            onApprove = vm::approveAgentPatch,
            onReject = vm::rejectAgentPatch,
            onRestoreCheckpoint = vm::restoreAgentCheckpoint,
            onOpenHistory = { vm.loadAgentSessions(); overlay = Overlay.AgentHistory },
            onNewSession = vm::startNewAgentSession,
            onPlanToggle = vm::setAgentPlanFirst,
            onApprovePlan = vm::approveAgentPlan,
            onRejectPlan = vm::rejectAgentPlan,
            onCancel = vm::cancelAgent,
            onDismiss = { vm.cancelAgent(); closeOverlay() }
        )
    }

    if (overlay == Overlay.AgentHistory) {
        AgentHistoryDialog(
            sessions = ui.agentSessions,
            loading = ui.agentSessionsLoading,
            onOpen = { id ->
                vm.openAgentSession(id)
                overlay = Overlay.Agent
            },
            onDelete = vm::deleteAgentSession,
            onDismiss = ::closeOverlay,
        )
    }

    if (overlay == Overlay.LocalModels) {
        LocalModelsDialog(
            models = ui.localModels,
            activeId = ui.settings.localModelId,
            useLocal = ui.settings.useLocalModel,
            loading = ui.localModelsLoading,
            onDownload = vm::downloadLocalModel,
            onCancelDownload = vm::cancelLocalModelDownload,
            onDelete = vm::deleteLocalModel,
            onSelect = vm::selectLocalModel,
            onToggleUse = vm::setUseLocalModel,
            onDismiss = ::closeOverlay,
        )
    }

    if (overlay == Overlay.Symbols) {
        SymbolOutlineDialog(
            fileName = ui.currentFile?.name ?: "当前文件",
            symbols = ui.symbolOutline,
            loading = ui.symbolsLoading,
            onPick = { line -> vm.gotoLine(line); closeOverlay() },
            onDismiss = ::closeOverlay,
        )
    }

    if (overlay == Overlay.Definitions) {
        DefinitionDialog(
            query = ui.definitionQuery,
            matches = ui.definitionMatches,
            loading = ui.definitionLoading,
            onPick = { definition ->
                vm.openDefinition(definition)
                closeOverlay()
            },
            onDismiss = ::closeOverlay,
        )
    }

    if (overlay == Overlay.GlobalSearch) {
        GlobalSearchDialog(
            query = gsearchQuery,
            results = ui.globalResults,
            searching = ui.globalSearching,
            onQueryChange = { gsearchQuery = it },
            onSearch = vm::searchAll,
            onOpen = { hit -> vm.openSearchHit(hit); closeOverlay() },
            onDismiss = ::closeOverlay
        )
    }

    if (overlay == Overlay.Diagnostics) {
        DiagnosticsDialog(
            diagnostics = ui.diagnostics,
            onRefresh = { vm.runDiagnostics() },
            onDismiss = ::closeOverlay,
            onOpenGuide = { closeOverlay(); overlay = Overlay.Onboarding }
        )
    }

    if (overlay == Overlay.RunConfig) {
        RunConfigDialog(
            args = ui.runArgs,
            onArgsChange = vm::onRunArgsChanged,
            onDismiss = ::closeOverlay
        )
    }

    (overlay as? Overlay.FileAction)?.let { fa ->
        val target = File(fa.path)
        FileActionDialog(
            target = target,
            onRename = { newName -> vm.renameFile(target, newName); closeOverlay() },
            onDelete = { vm.deleteFile(target); closeOverlay() },
            onDismiss = ::closeOverlay
        )
    }

    if (overlay == Overlay.Terminal) {
        TerminalDialog(
            lines = ui.terminalLines,
            cwd = ui.terminalCwd,
            busy = ui.terminalBusy,
            input = ui.terminalInput,
            onInputChange = vm::onTerminalInputChanged,
            onRun = vm::runTerminalCommand,
            onClear = vm::clearTerminal,
            onDismiss = { vm.closeTerminal(); closeOverlay() },
        )
    }

    if (overlay == Overlay.Settings) {
        SettingsDialog(
            settings = ui.settings,
            onThemeModeChange = { mode -> vm.updateSettings(ui.settings.copy(themeMode = mode)) },
            onFontSizeChange = { vm.updateSettings(ui.settings.copy(editorFontSize = it)) },
            onAutoSaveChange = { vm.updateSettings(ui.settings.copy(autoSave = it)) },
            onTimeoutChange = { vm.updateSettings(ui.settings.copy(timeoutSeconds = it)) },
            onEditorThemeChange = { theme ->
                vm.updateSettings(ui.settings.copy(editorTheme = theme))
            },
            onWordWrapChange = { vm.updateSettings(ui.settings.copy(wordWrap = it)) },
            onAutoCloseChange = { vm.updateSettings(ui.settings.copy(autoCloseBrackets = it)) },
            onShowLineNumbersChange = { vm.updateSettings(ui.settings.copy(showLineNumbers = it)) },
            onAiConfigChange = { url, key, model ->
                vm.updateSettings(
                    ui.settings.copy(
                        aiBaseUrl = url,
                        aiApiKey = key,
                        aiModel = model,
                        // 用户显式保存过一次，才认为「已配置」——默认占位值不算。
                        aiConfigured = url.isNotBlank()
                    )
                )
            },
            onMcpConfigChange = { enabled, endpoint ->
                vm.updateSettings(ui.settings.copy(mcpEnabled = enabled, mcpEndpoint = endpoint))
            },
            onAgentPlanFirstChange = vm::setAgentPlanFirst,
            onPluginsEnabledChange = { enabled ->
                vm.updateSettings(ui.settings.copy(pluginsEnabled = enabled))
            },
            onDismiss = ::closeOverlay,
            onOpenLocalModels = {
                closeOverlay()
                vm.refreshLocalModels()
                overlay = Overlay.LocalModels
            },
        )
    }

    if (overlay == Overlay.Onboarding) {
        OnboardingDialog(
            onDismiss = {
                uiPrefs.edit().putBoolean("onboarding_seen", true).apply()
                closeOverlay()
            },
            onNewProject = {
                uiPrefs.edit().putBoolean("onboarding_seen", true).apply()
                closeOverlay()
                overlay = Overlay.NewProject
            },
        )
    }

    if (overlay == Overlay.About) {
        AboutDialog(onDismiss = ::closeOverlay)
    }

    if (overlay == Overlay.NewFile) {
        NewFileDialog(
            onDismiss = ::closeOverlay,
            onCreate = { name -> vm.newFileInCurrentDir(name); closeOverlay() }
        )
    }

    if (overlay == Overlay.NewFolder) {
        NewFolderDialog(
            onDismiss = ::closeOverlay,
            onCreate = { name -> vm.newFolderInCurrentDir(name); closeOverlay() }
        )
    }

    if (overlay == Overlay.SwitchProject) {
        SwitchProjectDialog(
            projects = vm.listProjects(),
            currentPath = ui.tree?.path,
            onSelect = { dir -> vm.openProject(dir); closeOverlay() },
            onNewProject = { closeOverlay(); overlay = Overlay.NewProject },
            onDelete = { dir -> vm.deleteProject(dir) },
            onDismiss = ::closeOverlay
        )
    }

    if (overlay == Overlay.GotoLine) {
        GotoLineDialog(
            onDismiss = ::closeOverlay,
            onGo = { line -> vm.gotoLine(line); closeOverlay() }
        )
    }

    if (overlay == Overlay.Packages) {
        PackagesDialog(
            context = LocalContext.current,
            onToast = { msg ->
                scope.launch { snackbar.showSnackbar(msg) }
            },
            onDismiss = ::closeOverlay
        )
    }
}

/**
 * 编辑器空态：工具链已就绪、但还没打开任何文件时展示。
 *
 * 原先这里只有一句「从左侧选择一个文件开始编辑」——对第一次打开 App 的人
 * 等于什么都没说：他不知道左侧是什么、项目在哪、该点哪个。这是整个产品
 * 使用逻辑上最大的一个断点，所以直接改成三段式引导：
 *   ① 一句话说清这是什么、能干什么；
 *   ② 两个「立刻能用」的动作（新建项目 / 导入现有文件）；
 *   ③ 另外给一条「已经会用了」的快捷路径——直接打开文件树。
 */
@Composable
private fun EditorEmptyState(
    hasProject: Boolean,
    onOpenDrawer: () -> Unit,
    onNewProject: () -> Unit,
    onImport: () -> Unit,
    onGuide: () -> Unit
) {
    val cs = MaterialTheme.colorScheme
    // 入场动效：内容淡入并轻微上移。
    // 空态是用户进入 App 看到的第一屏，加一点入场让首屏不显得"硬邦邦地砸出来"；
    // 位移刻意做得很小（约 1/8 高度 ≈ 10dp），符合 Motion 里「克制」的约定。
    val appear = remember { Animatable(0f) }
    LaunchedEffect(hasProject) {
        appear.snapTo(0f)
        appear.animateTo(1f, Motion.enterSpec())
    }
    Box(
        Modifier.fillMaxSize().background(cs.background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            Modifier
                .padding(horizontal = 32.dp)
                .graphicsLayer {
                    alpha = appear.value
                    translationY = (1f - appear.value) * 24f
                },
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                Icons.Outlined.Terminal, null,
                tint = cs.primary.copy(alpha = 0.75f),
                modifier = Modifier.size(30.dp)
            )
            Spacer(Modifier.height(Dimens.lg))
            Text(
                if (hasProject) "选一个文件开始" else "写代码，不用联网",
                style = MaterialTheme.typography.titleMedium,
                color = cs.onSurface
            )
            Spacer(Modifier.height(6.dp))
            Text(
                if (hasProject) {
                    "从左侧文件树点开任意文件即可编辑，底部面板会显示运行结果"
                } else {
                    "Python / JavaScript / Lua 可运行，另有 17 种语言可编辑；标准库与 Git 都已内置"
                },
                style = MaterialTheme.typography.bodySmall,
                color = cs.muted,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(Dimens.xl))
            if (hasProject) {
                // 已有项目：唯一该做的事就是去打开文件
                PrimaryQuietButton("打开文件树", Icons.Outlined.Menu, onOpenDrawer)
            } else {
                // 空项目：给出两条真正能往下走的路径，而不是一句提示
                PrimaryQuietButton("新建项目", Icons.Filled.Add, onNewProject)
                Spacer(Modifier.height(Dimens.sm))
                TextButton(onClick = onImport) {
                    Text(
                        "或导入手机里的现有代码",
                        style = MaterialTheme.typography.labelMedium,
                        color = cs.muted
                    )
                }
            }
            Spacer(Modifier.height(Dimens.sm))
            TextButton(onClick = onGuide) {
                Text(
                    "先看 1 分钟使用指南",
                    style = MaterialTheme.typography.labelMedium,
                    color = cs.primary
                )
            }
        }
    }
}

/** 空态里的主行动按钮：描边而非实心，与整体克制风格一致 */
@Composable
private fun PrimaryQuietButton(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    onClick: () -> Unit
) {
    val cs = MaterialTheme.colorScheme
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(cs.primary.copy(alpha = 0.10f))
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, null, tint = cs.primary, modifier = Modifier.size(17.dp))
        Spacer(Modifier.width(Dimens.sm))
        Text(label, style = MaterialTheme.typography.labelLarge, color = cs.primary)
    }
}

/**
 * 首次启动的解压进度页。
 * 大留白 + 一行说明，不再用堆控件的方式表达「请稍候」。
 */
@Composable
private fun PreparingScreen(message: String, progress: Float) {
    val cs = MaterialTheme.colorScheme
    Box(Modifier.fillMaxSize().background(cs.background), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(horizontal = Dimens.xxl)
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(26.dp),
                strokeWidth = 2.dp,
                color = cs.primary
            )
            Spacer(Modifier.height(Dimens.lg))
            Text(message, style = MaterialTheme.typography.bodyMedium, color = cs.muted,
                textAlign = TextAlign.Center)
            if (progress >= 0f) {
                Spacer(Modifier.height(Dimens.lg))
                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .width(200.dp)
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp)),
                    color = cs.primary,
                    trackColor = cs.hairline
                )
                Spacer(Modifier.height(Dimens.sm))
                MonoText(
                    "首次启动需解压离线工具链，请稍候…",
                    color = cs.faint, fontSize = 10
                )
            }
        }
    }
}

/**
 * 工具链缺失时的引导页。
 *
 * 这是用户最可能撞上的失败场景（忘了打包 assets），
 * 与其让他对着报错发呆，不如直接告诉他怎么修。
 */
@Composable
private fun MissingToolchainScreen(
    message: String,
    detail: String?,
    onRetry: () -> Unit
) {
    val cs = MaterialTheme.colorScheme
    val context = LocalContext.current
    Box(
        Modifier
            .fillMaxSize()
            .background(cs.background)
            .padding(Dimens.xxl),
        contentAlignment = Alignment.Center
    ) {
        Column {
            Text(message, style = MaterialTheme.typography.titleMedium, color = cs.error)
            Spacer(Modifier.height(Dimens.md))
            Text(
                "这不是你的代码问题：CodePocket 的 Python 运行时没有从安装包里解压出来。JavaScript/Lua 是纯 Java，不受影响。",
                style = MaterialTheme.typography.bodyMedium,
                color = cs.muted
            )
            Spacer(Modifier.height(Dimens.xl))
            SectionLabel("先这样做")
            Spacer(Modifier.height(Dimens.sm))
            listOf(
                "1. 点下面的「重新检测」，多数情况会恢复",
                "2. 仍失败：卸载旧版，安装最新 APK（不要只覆盖更新）",
                "3. 还不行：到「关于」复制崩溃日志反馈，日志里会记录缺失的 .so"
            ).forEach { step ->
                MonoText(
                    step,
                    color = cs.onSurface.copy(alpha = 0.82f),
                    fontSize = 11,
                    modifier = Modifier.padding(vertical = 3.dp)
                )
            }
            detail?.let {
                Spacer(Modifier.height(Dimens.lg))
                MonoText(it, color = cs.secondary, fontSize = 11)
            }
            Spacer(Modifier.height(Dimens.xl))
            androidx.compose.material3.TextButton(onClick = onRetry) {
                Text("重新检测", style = MaterialTheme.typography.labelLarge, color = cs.primary)
            }
            androidx.compose.material3.TextButton(onClick = {
                val ctx = context
                val log = com.devterminal.engine.CrashLogger.readAll(ctx).ifBlank { "（暂无崩溃日志）" }
                val cm = ctx.getSystemService(android.content.Context.CLIPBOARD_SERVICE)
                    as android.content.ClipboardManager
                cm.setPrimaryClip(android.content.ClipData.newPlainText("CodePocket crash log", log))
                android.widget.Toast.makeText(ctx, "崩溃日志已复制", android.widget.Toast.LENGTH_SHORT).show()
            }) {
                Text("复制崩溃日志", style = MaterialTheme.typography.labelLarge, color = cs.muted)
            }
        }
    }
}

/**
 * 组装命令面板的动作列表。
 * 纯 UI 动作直接执行；打开对话框的通过 [onCommand] 回调交给调用方置位状态。
 */
private fun buildCommands(
    vm: EditorViewModel,
    ui: UiState,
    context: android.content.Context,
    onCommand: (String) -> Unit
): List<Command> = buildList {
    add(Command("run", "运行当前文件", ui.currentFile?.name ?: "未打开文件",
        Icons.Filled.PlayArrow) { vm.runCurrent() })
    add(Command("save", "保存当前文件", "写入磁盘",
        Icons.Filled.Save) { vm.save() })
    add(Command("undo", "撤销", "编辑器撤销栈上一步",
        Icons.AutoMirrored.Filled.Undo) { vm.undo() })
    add(Command("redo", "重做", "编辑器重做栈下一步",
        Icons.Filled.Redo) { vm.redo() })
    add(Command("share", "分享当前文件", "以纯文本发送 ${ui.currentFile?.name ?: ""}".trim(),
        Icons.Filled.Share) {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, ui.editorText)
            }
            runCatching { context.startActivity(Intent.createChooser(intent, "分享代码")) }
        })
    add(Command("find", "查找 / 替换", "计数跳转 + 单个/全部替换",
        Icons.Filled.Search) { vm.showFind(true) })
    add(Command("gsearch", "全局搜索", "在所有项目文件中查找",
        Icons.Filled.Search) { onCommand("gsearch") })
    add(Command("git", "Git 仓库", "状态 / 提交 / 推送 / 拉取",
        Icons.Filled.AccountTree) { onCommand("git") })
    add(Command("ai", "AI 助手", "解释代码 / 修复报错 / 生成测试",
        Icons.Filled.AutoAwesome) { onCommand("ai") })
    add(Command("agent", "Agent 模式", "读项目 / 搜索 / 按行改文件 / 批准",
        Icons.Filled.AutoAwesome) { onCommand("agent") })
    add(Command("terminal", "终端", "在项目根执行 sh 命令",
        Icons.Outlined.Terminal) { onCommand("terminal") })
    add(Command("runconfig", "运行配置", "命令行参数",
        Icons.Outlined.Terminal) { onCommand("runconfig") })
    add(Command("preview", "实时预览", "Markdown / HTML 分屏渲染",
        Icons.Outlined.Preview) { onCommand("preview") })
    add(Command("newproj", "新建项目", "${Templates.all.size} 个模板",
        Icons.Filled.Add) { onCommand("newproj") })
    add(Command("export", "导出当前文件", "通过 SAF 写到手机任意位置",
        Icons.Filled.FileUpload) { onCommand("export") })
    add(Command("goto", "跳转到行", "输入行号直达",
        Icons.Outlined.NavigateBefore) { onCommand("goto") })
    add(Command("symbols", "符号大纲", "当前文件的类 / 函数列表",
        Icons.Filled.AccountTree) { onCommand("symbols") })
    add(Command("definition", "跳转到定义", "光标下的 Python 符号 / 跨文件",
        Icons.Filled.Search) { onCommand("definition") })
    add(Command("models", "本地模型", "下载 MiniCPM5 / 离线 Agent",
        Icons.Filled.AutoAwesome) { onCommand("models") })
    add(Command("agentHistory", "Agent 历史会话", "回放之前的工具轨迹",
        Icons.Filled.AccountTree) { onCommand("agentHistory") })
    add(Command("copyout", "复制全部输出", "写入剪贴板",
        Icons.Filled.ContentCopy) { vm.copyOutput() })
    add(Command("newfile", "新建文件", "在项目根创建",
        Icons.Filled.NoteAdd) { onCommand("newfile") })
    add(Command("newfolder", "新建文件夹", "在项目根创建",
        Icons.Filled.CreateNewFolder) { onCommand("newfolder") })
    add(Command("packages", "离线 Python 包", "查看内置库 / 安装 wheel",
        Icons.Outlined.LibraryBooks) { onCommand("packages") })
    add(Command("diag", "环境自检", "Python / JavaScript / Lua / Git",
        Icons.Outlined.HealthAndSafety) { onCommand("diag") })
    add(Command("settings", "设置", "主题 / 字号 / 超时 / AI 端点",
        Icons.Filled.Settings) { onCommand("settings") })
    add(Command("guide", "使用指南", "3 分钟上手 / 运行失败排查",
        Icons.Outlined.LibraryBooks) { onCommand("guide") })
    add(Command("about", "关于 CodePocket", "版本与开源许可",
        Icons.Outlined.Info) { onCommand("about") })
    ui.customCommands.forEach { cmd ->
        add(Command(
            "cmd-${cmd.id}",
            "命令：${cmd.title}",
            cmd.description.ifBlank { "项目自定义 Agent 指令" },
            Icons.Filled.Bolt
        ) {
            vm.prefillAgent(cmd.body)
            onCommand("agent")
        })
    }
    // 代码片段：按当前文件语言过滤，避免 Python 文件里冒出来 Lua 片段
    val currentSpec = LanguageRegistry.forFile(ui.currentFile)
    com.devterminal.engine.Snippets.forLanguage(currentSpec.id).forEach { s ->
        add(Command(
            "snip-${s.id}",
            "插入片段：${s.title}",
            s.description,
            Icons.Outlined.Terminal
        ) { vm.insertSymbol(s.code) })
    }
}

/** 判断是否是图片文件（matplotlib savefig 的 png 等） */
private fun isImageFile(file: File?): Boolean =
    file?.extension?.lowercase() in setOf("png", "jpg", "jpeg", "gif", "webp", "bmp")

/** 图片查看器：先读 bounds，再按 inSampleSize 降采样，避免大图 OOM。 */
@Composable
private fun ImageFileViewer(file: File, modifier: Modifier = Modifier) {
    val bitmap = remember(file.absolutePath) {
        runCatching { decodeSampledBitmap(file.absolutePath, 1600) }.getOrNull()
    }
    Box(modifier.background(MaterialTheme.colorScheme.background), contentAlignment = Alignment.Center) {
        if (bitmap != null) {
            androidx.compose.foundation.Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = file.name,
                modifier = Modifier.fillMaxSize(),
                contentScale = androidx.compose.ui.layout.ContentScale.Fit
            )
        } else {
            QuietHint("无法解码图片：${file.name}")
        }
    }
}

/** 只解到 maxDim 以内，兼顾清晰度和内存。 */
private fun decodeSampledBitmap(path: String, maxDim: Int): android.graphics.Bitmap? {
    val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
    android.graphics.BitmapFactory.decodeFile(path, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / sample > maxDim || bounds.outHeight / sample > maxDim) {
        sample *= 2
    }
    val opts = android.graphics.BitmapFactory.Options().apply {
        inSampleSize = sample
        inPreferredConfig = android.graphics.Bitmap.Config.RGB_565
    }
    return android.graphics.BitmapFactory.decodeFile(path, opts)
}
