package com.devterminal.ui

import android.util.TypedValue
import android.view.KeyEvent
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.viewinterop.AndroidView
import com.devterminal.engine.LanguageRegistry
import com.devterminal.engine.LanguageSpec
import io.github.rosemoe.sora.event.ContentChangeEvent
import io.github.rosemoe.sora.event.SelectionChangeEvent
import io.github.rosemoe.sora.lang.Language
import io.github.rosemoe.sora.langs.textmate.TextMateColorScheme
import io.github.rosemoe.sora.langs.textmate.TextMateLanguage
import io.github.rosemoe.sora.langs.textmate.registry.GrammarRegistry
import io.github.rosemoe.sora.langs.textmate.registry.ThemeRegistry
import io.github.rosemoe.sora.langs.textmate.registry.model.ThemeModel
import io.github.rosemoe.sora.widget.CodeEditor
import io.github.rosemoe.sora.widget.component.EditorAutoCompletion
import io.github.rosemoe.sora.widget.schemes.EditorColorScheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.atomic.AtomicReference

/**
 * 编辑器主题清单：assets/textmate/themes 下的文件名（不含扩展名）。
 * "auto" 不在其中——它表示跟随 App 明暗，在 [resolveTheme] 里解析。
 */
val EDITOR_THEMES = listOf("auto", "darcula", "monokai", "tomorrow-night-blue", "solarized-dark", "quiet-light", "solarized-light")

/** 深色 / 浅色两套 TextMate 主题名（与 assets/textmate/themes 下的文件对应） */
private const val THEME_DARK = "darcula"
private const val THEME_LIGHT = "quiet-light"

/** "auto" 按明暗解析成具体主题名；其余原样返回（未知值兜底回 auto 行为） */
private fun resolveTheme(editorTheme: String, dark: Boolean): String =
    if (editorTheme == "auto" || editorTheme !in EDITOR_THEMES) {
        if (dark) THEME_DARK else THEME_LIGHT
    } else editorTheme

/**
 * 基于 SoraEditor 的代码编辑器（经 AndroidView 桥接进 Compose）。
 *
 * SoraEditor 为 LGPL-2.1：本项目通过其公开 API 调用，源码开源即可满足合规；
 * 若将来闭源分发，需保证用户可替换该库（动态链接 + 提供可重链接的目标文件）。
 *
 * 补全实现要点：sora-editor 的补全由 **Language** 提供，
 * 因此用 [StaticCompletionLanguage] 包一层 TextMate 语言（保留高亮 + 静态补全）。
 *
 * 修复要点：
 * - **语言随文件切换**：原先只在 factory 里装一次语言，从 .py 切到 .java 后
 *   高亮和补全仍按 Python 走；现在文件/语言变化即重新装配。
 * - **主题跟随明暗**：原先恒为 darcula，浅色主题下编辑器是黑底，非常割裂。
 * - **实例生命周期**：editor 在「未打开文件」分支之前创建，并由 DisposableEffect
 *   统一释放，避免关闭最后一个 Tab 时实例泄漏。
 */
@Composable
fun CodeEditorView(
    file: File?,
    text: String,
    onTextChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    readOnly: Boolean = false,
    fontSize: Int = 14,
    language: LanguageSpec = LanguageRegistry.PYTHON,
    darkTheme: Boolean = true,
    /** 编辑器主题："auto" 跟随明暗，其余为 [EDITOR_THEMES] 里的固定主题 */
    editorTheme: String = "auto",
    onCursorChange: (Int, Int) -> Unit = { _, _ -> },
    /** 每次自增触发一次插入，insertText 为要插入的内容 */
    insertSignal: Long = 0,
    insertText: String? = null,
    /** 每次自增触发一次退格 */
    backspaceSignal: Long = 0,
    /** 每次自增触发一次撤销（SoraEditor 内置撤销栈） */
    undoSignal: Long = 0,
    /** 每次自增触发一次重做 */
    redoSignal: Long = 0,
    /** 查找跳转请求：pos 为全局字符偏移，requestId 变化即执行 */
    findRequest: FindRequest? = null,
    /**
     * 跳转到指定行（0 基）。
     *
     * 为什么需要它：输出面板里的报错行原本只是一段只读文本，
     * 用户看到 `main.py line 12` 只能自己数行号滚过去——这是整个
     * 「写码 → 运行 → 看报错 → 改代码」闭环里最硌手的一环。
     * 跳转能力（setSelection + ensureSelectionVisible）编辑器本来就有，
     * 只是没有对外暴露，这里把它接出来。
     */
    scrollToLine: ScrollToLineRequest? = null,
    /** 双指缩放调整字号（zoom 增量，累积到阈值回调一次） */
    onPinchZoom: ((Int) -> Unit)? = null,
    /** 自动换行：长行折到下一行 */
    wordWrap: Boolean = false,
    /** 自动闭合括号/引号 */
    autoCloseBrackets: Boolean = true,
    /** 显示行号 */
    showLineNumbers: Boolean = true
) {
    val context = LocalContext.current
    // 必须在「未打开文件」分支之前创建，否则关闭最后一个 Tab 会让实例泄漏
    val editor = remember { CodeEditor(context) }
    DisposableEffect(editor) {
        onDispose { runCatching { editor.release() } }
    }

    // 软键盘弹出后编辑器获得焦点：把光标选区主动滚回可视区，
    // 避免光标被顶起的 IME 或自身滚动条压在屏幕外。
    LaunchedEffect(Unit) {
        editor.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) {
                editor.postDelayed(
                    { runCatching { editor.ensureSelectionVisible() } },
                    60,
                )
            }
        }
    }

    // 键盘尺寸变化（弹出、收起、切换输入法）时，SoraEditor 的 View 高度会变，
    // 但焦点没有重新变化；这里监听 IME inset，再主动把光标滚回可视区。
    DisposableEffect(editor) {
        ViewCompat.setOnApplyWindowInsetsListener(editor) { _, insets ->
            if (insets.isVisible(WindowInsetsCompat.Type.ime())) {
                editor.postDelayed(
                    { runCatching { editor.ensureSelectionVisible() } },
                    80,
                )
            }
            insets
        }
        onDispose { ViewCompat.setOnApplyWindowInsetsListener(editor, null) }
    }

    // 语法/主题注册表全局只需初始化一次；读 assets 是 IO，放到后台线程
    var textMateReady by remember { mutableStateOf(textMateInitialized) }
    LaunchedEffect(Unit) {
        if (textMateReady) return@LaunchedEffect
        withContext(Dispatchers.IO) { initTextMate(context.assets) }
        textMateReady = true
    }

    // 让补全能读到当前文档；用可变引用避免闭包捕获旧值
    val docRef = remember { AtomicReference(text) }
    val cursorCallback = remember { onCursorChange }
    val zoomCallback = rememberUpdatedState(onPinchZoom)

    if (file == null) {
        Box(
            modifier = modifier.background(MaterialTheme.colorScheme.background),
            contentAlignment = Alignment.Center
        ) {
            Text(
                "从左侧选择一个文件开始编辑",
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                textAlign = TextAlign.Center
            )
        }
        return
    }

    // 文件（扩展名）或语言变化 → 重新装配高亮与补全
    LaunchedEffect(textMateReady, file.absolutePath, language) {
        if (!textMateReady) return@LaunchedEffect
        applyLanguage(editor, file, language, docRef)
    }

    // 主题切换（含 auto 跟随明暗）→ 换主题。主题切换后必须重建 colorScheme 才会生效
    LaunchedEffect(textMateReady, editorTheme, darkTheme) {
        if (!textMateReady) return@LaunchedEffect
        withContext(Dispatchers.IO) {
            runCatching { ThemeRegistry.getInstance().setTheme(resolveTheme(editorTheme, darkTheme)) }
        }
        applyScheme(editor)
        applyLanguage(editor, file, language, docRef)
    }

    // 符号栏插入：直接走编辑器内部 Content.insert，能正确进撤销栈
    LaunchedEffect(insertSignal) {
        if (insertSignal <= 0) return@LaunchedEffect
        val toInsert = insertText ?: return@LaunchedEffect
        runCatching {
            val cursor = editor.cursor
            editor.text.insert(cursor.leftLine, cursor.leftColumn, toInsert)
        }
    }

    // 符号栏退格：模拟删除键事件，编辑器自己处理选中/删除逻辑
    LaunchedEffect(backspaceSignal) {
        if (backspaceSignal <= 0) return@LaunchedEffect
        runCatching {
            editor.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DEL))
        }
    }

    // 撤销 / 重做：走 SoraEditor 内置编辑历史栈
    LaunchedEffect(undoSignal) {
        if (undoSignal <= 0) return@LaunchedEffect
        runCatching { editor.undo() }
    }
    LaunchedEffect(redoSignal) {
        if (redoSignal <= 0) return@LaunchedEffect
        runCatching { editor.redo() }
    }

    // 查找跳转：把全局偏移换算成行列后移动光标并滚动到可见
    LaunchedEffect(findRequest?.requestId) {
        val req = findRequest ?: return@LaunchedEffect
        runCatching {
            val content = editor.text.toString()
            val pos = req.pos.coerceIn(0, content.length)
            val line = content.substring(0, pos).count { it == '\n' }
            val col = if (line == 0) pos
            else pos - (content.lastIndexOf('\n', pos - 1) + 1)
            runCatching { editor.setSelection(line, col) }
            runCatching { editor.ensureSelectionVisible() }
        }
    }

    // 跳转到指定行（报错行跳到行首；会话恢复光标时带具体列）：滚动到可见
    LaunchedEffect(scrollToLine?.seq) {
        val req = scrollToLine ?: return@LaunchedEffect
        runCatching {
            val lineCount = editor.text.lineCount
            val line = req.line.coerceIn(0, (lineCount - 1).coerceAtLeast(0))
            val col = req.col.coerceAtLeast(0)
            runCatching { editor.setSelection(line, col) }
            runCatching { editor.ensureSelectionVisible() }
        }
    }

    AndroidView(
        // P1-7【待真机验证】：SoraEditor(AndroidView) 与 Compose 嵌套滚动协作。
        // rememberNestedScrollInteropConnection() 在当前 Compose BOM 2024.12 下
        // 未解析，暂不挂 nestedScroll 桥。编辑器自身滚动由 SoraEditor View 体系处理，
        // 待真机验证捏合/单指滚动竞争后再决定是否补嵌套滚动桥接。
        modifier = modifier
            .pointerInput(Unit) {
            // 双指捏合调整字号：累积增量达到阈值才回调，避免字号抖动。
            // 用 rememberUpdatedState + 固定 key，手势不会因重组被重启。
            var pending = 0f
            detectTransformGestures { _, _, zoom, _ ->
                if (zoom != 1f) {
                    pending += (zoom - 1f)
                    if (pending > 0.14f) { zoomCallback.value?.invoke(1); pending = 0f }
                    else if (pending < -0.14f) { zoomCallback.value?.invoke(-1); pending = 0f }
                }
            }
        },
        factory = {
            editor.apply {
                setText(text)
                isEditable = !readOnly
                setTextSize(fontSize.toFloat())
                applyScheme(this)
                applyLanguage(this, file, language, docRef)
                // 自动换行（SoraEditor API：CodeEditor.setWordwrap）
                runCatching { setWordwrap(wordWrap) }
                // 自动闭合括号/引号（SoraEditor API：props.symbolPairAutoCompletion）
                runCatching { props.symbolPairAutoCompletion = autoCloseBrackets }
                // 行号（SoraEditor API：CodeEditor.setLineNumberEnabled）
                runCatching { setLineNumberEnabled(showLineNumbers) }

                // 启用补全组件（getter 是 getComponent）
                runCatching {
                    getComponent(EditorAutoCompletion::class.java).isEnabled = true
                }

                // 内容变更回写。这里每次按键确实要 editor.text.toString()（O(n)），
                // 但**不能**对 onTextChange 做节流：update{} 块用
                // `view.text.toString() != text` 判断是否外部改了文档，若 VM 文本
                // 滞后，光标事件触发的重组会把用户刚敲的字 setText 覆盖掉。
                // 折中：docRef 与 onTextChange 共用同一次 toString（已合并为一次拷贝），
                // 增量回写需 SoraEditor 提供稳定的 diff 区间，暂不冒险改动。
                subscribeEvent(ContentChangeEvent::class.java) { _, _ ->
                    val current = editor.text.toString()
                    docRef.set(current)
                    onTextChange(current)
                }

                // 光标/选区变化 → 状态栏的行列显示
                subscribeEvent(SelectionChangeEvent::class.java) { event, _ ->
                    val line = runCatching { event.left.line }.getOrDefault(0)
                    val column = runCatching { event.left.column }.getOrDefault(0)
                    cursorCallback(line, column)
                }
            }
        },
        update = { view ->
            docRef.set(text)
            runCatching { view.setWordwrap(wordWrap) }
            runCatching { view.props.symbolPairAutoCompletion = autoCloseBrackets }
            runCatching { view.setLineNumberEnabled(showLineNumbers) }
            // 字号实时跟随设置（setTextSize 单位为 sp）
            val targetPx = TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_SP, fontSize.toFloat(), view.resources.displayMetrics
            )
            if (view.textSizePx != targetPx) view.setTextSize(fontSize.toFloat())
            // 仅当外部内容真的变化时才 setText，避免打断输入
            if (view.text.toString() != text) {
                val line = runCatching { view.cursor.leftLine }.getOrDefault(0)
                val col = runCatching { view.cursor.leftColumn }.getOrDefault(0)
                view.setText(text)
                runCatching { view.setSelection(line, col) }
            }
        }
    )
}

/** 装配语言：TextMate 高亮 + 静态补全 */
private fun applyLanguage(
    editor: CodeEditor,
    file: File,
    language: LanguageSpec,
    docRef: AtomicReference<String>
): Language? {
    return runCatching {
        val textMate = TextMateLanguage.create(language.grammarName ?: file.extension, false)
        val wrapped = StaticCompletionLanguage(
            delegate = textMate,
            devLanguage = language.completionProfile,
            documentSupplier = { docRef.get() }
        )
        editor.setEditorLanguage(wrapped)
        wrapped
    }.onFailure {
        // 语法文件缺失（比如没打包某种语言的 grammar）时降级为纯文本，不让编辑器崩
        runCatching { editor.setEditorLanguage(null) }
    }.getOrNull()
}

/**
 * 用注册表里的**当前**主题重建配色方案。
 * 主题由 [ThemeRegistry.setTheme] 切换，切换后必须重建 scheme 才会生效。
 */
private fun applyScheme(editor: CodeEditor) {
    runCatching { TextMateColorScheme.create(ThemeRegistry.getInstance()) }
        .onSuccess { editor.colorScheme = it }
        .onFailure { editor.colorScheme = EditorColorScheme() }
}

@Volatile
private var textMateInitialized = false

private fun initTextMate(assets: android.content.res.AssetManager) {
    if (textMateInitialized) return
    runCatching {
        // 语法文件从 APK assets 读取
        io.github.rosemoe.sora.langs.textmate.registry.FileProviderRegistry.getInstance()
            .addFileProvider(
                io.github.rosemoe.sora.langs.textmate.registry.provider.AssetsFileResolver(assets)
            )
        GrammarRegistry.getInstance().loadGrammars("textmate/languages.json")
        // 全部主题一次性载入注册表，设置里切换时零 IO 等待
        val registry = ThemeRegistry.getInstance()
        EDITOR_THEMES.filter { it != "auto" }.forEach { name ->
            val source = org.eclipse.tm4e.core.registry.IThemeSource.fromInputStream(
                assets.open("textmate/themes/$name.json"),
                "$name.json",
                Charsets.UTF_8
            )
            registry.loadTheme(ThemeModel(source, name))
        }
        textMateInitialized = true
    }
}
