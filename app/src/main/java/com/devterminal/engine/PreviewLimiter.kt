package com.devterminal.engine

/**
 * 预览输入上限。
 *
 * 编辑器允许打开 5MB 文本，但 Markdown/HTML 渲染会展开成更大的 DOM；
 * 512K 字符足够看一篇长文/一个中型 HTML 页面，超出只截断预览，
 * **不修改编辑器里的原文**，并让 UI 明确提示。
 */
object PreviewLimiter {
    const val MAX_CHARS = 512 * 1024

    data class Result(val text: String, val truncated: Boolean, val originalChars: Int)

    fun limit(text: String): Result {
        if (text.length <= MAX_CHARS) return Result(text, false, text.length)
        return Result(text.take(MAX_CHARS), true, text.length)
    }
}
