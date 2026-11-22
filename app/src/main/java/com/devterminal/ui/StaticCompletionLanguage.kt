package com.devterminal.ui

import android.os.Bundle
import com.devterminal.engine.CompletionProfile
import com.devterminal.engine.CompletionProvider
import io.github.rosemoe.sora.lang.Language
import io.github.rosemoe.sora.lang.analysis.AnalyzeManager
import io.github.rosemoe.sora.lang.completion.CompletionItem
import io.github.rosemoe.sora.lang.completion.CompletionItemKind
import io.github.rosemoe.sora.lang.completion.SimpleCompletionItem
import io.github.rosemoe.sora.lang.completion.CompletionPublisher
import io.github.rosemoe.sora.lang.completion.CompletionHelper
import io.github.rosemoe.sora.lang.format.Formatter
import io.github.rosemoe.sora.lang.smartEnter.NewlineHandler
import io.github.rosemoe.sora.text.CharPosition
import io.github.rosemoe.sora.text.ContentReference
import io.github.rosemoe.sora.widget.SymbolPairMatch

/**
 * 静态补全语言包装器。
 *
 * 设计：sora-editor 的补全入口是 [Language.requireAutoComplete]，
 * 而不是在编辑器上 setProvider。因此这里包一层：
 *  - 高亮/分析等能力**委托**给内层语言（通常是 TextMateLanguage）
 *  - 补全由 [CompletionProvider] 的静态词表提供
 *
 * 这样既保留语法高亮，又零 LSP 进程开销，契合离线定位。
 */
class StaticCompletionLanguage(
    private val delegate: Language,
    private val devLanguage: CompletionProfile,
    /** 供后台线程读取当前文档全文 */
    private val documentSupplier: () -> String
) : Language {

    override fun getAnalyzeManager(): AnalyzeManager = delegate.analyzeManager

    override fun getInterruptionLevel(): Int = delegate.interruptionLevel

    /**
     * 由编辑器在**工作线程**调用，提供补全候选。
     * 注意：不要在此触碰 UI。
     */
    override fun requireAutoComplete(
        content: ContentReference,
        position: CharPosition,
        publisher: CompletionPublisher,
        extraArguments: Bundle
    ) {
        // 先尝试提取当前光标处的前缀
        val prefix = runCatching {
            CompletionHelper.computePrefix(content, position) { c ->
                c.isLetterOrDigit() || c == '_'
            }.toString()
        }.getOrDefault("")

        val text = documentSupplier()
        val items = CompletionProvider.candidates(devLanguage, prefix, text)
        if (items.isEmpty()) return

        items.forEach { item ->
            publisher.addItem(item.toCompletionItem(prefix.length))
        }
    }

    override fun getIndentAdvance(content: ContentReference, line: Int, column: Int): Int =
        delegate.getIndentAdvance(content, line, column)

    override fun useTab(): Boolean = delegate.useTab()

    override fun getFormatter(): Formatter = delegate.formatter

    override fun getSymbolPairs(): SymbolPairMatch = delegate.symbolPairs

    override fun getNewlineHandlers(): Array<NewlineHandler>? = delegate.newlineHandlers

    override fun destroy() {
        delegate.destroy()
    }
}

/** 把静态候选转成编辑器可渲染的补全项（0.23.5 SimpleCompletionItem） */
private fun CompletionProvider.Item.toCompletionItem(prefixLength: Int): CompletionItem =
    SimpleCompletionItem(
        text,
        detail.ifEmpty { kindLabel(kind) },
        prefixLength,
        text
    ).kind(kindToCompletionKind(kind))

private fun kindToCompletionKind(kind: CompletionProvider.Kind): CompletionItemKind = when (kind) {
    CompletionProvider.Kind.KEYWORD -> CompletionItemKind.Keyword
    CompletionProvider.Kind.BUILTIN -> CompletionItemKind.Function
    CompletionProvider.Kind.MODULE -> CompletionItemKind.Module
    CompletionProvider.Kind.CLASS -> CompletionItemKind.Class
    CompletionProvider.Kind.METHOD -> CompletionItemKind.Method
}

private fun kindLabel(kind: CompletionProvider.Kind): String = when (kind) {
    CompletionProvider.Kind.KEYWORD -> "关键字"
    CompletionProvider.Kind.BUILTIN -> "内置"
    CompletionProvider.Kind.MODULE -> "模块"
    CompletionProvider.Kind.CLASS -> "类"
    CompletionProvider.Kind.METHOD -> "方法"
}
