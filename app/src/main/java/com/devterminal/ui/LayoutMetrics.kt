package com.devterminal.ui

/**
 * 主界面纵向空间的纯计算，放在 UI 之外便于单测。
 *
 * 手机软键盘弹出时可用高度会突然变矮。如果这时把「用户上次拖出来的面板高度」
 * 直接落盘，键盘收起后编辑器就永远变矮了；所以偏好高度与当前可见高度必须分开：
 *  - preferred：用户拖拽/设置保存的高度，跨会话记忆；
 *  - visible：本轮实际渲染高度，只做临时夹取，不写回设置。
 */
object LayoutMetrics {
    /** 输出面板最小高度：至少能同时看到状态行和两行输出 */
    const val MIN_OUTPUT_DP = 120f
    /** 展开 stdin 输入行时，面板至少要容纳头部、输入框与移动端方向键 */
    const val MIN_OUTPUT_WITH_INPUT_DP = 220f
    /** 极矮屏 + 键盘同时出现时的输入态下限：宁可少显示两行输出，也不能把编辑器挤没 */
    const val COMPACT_OUTPUT_WITH_INPUT_DP = 150f
    /** 给编辑器留的最小可视高度，避免输出面板把代码区吃光 */
    const val MIN_EDITOR_DP = 120f
    /** 中间拖拽把手的高度 */
    const val DRAG_HANDLE_DP = 14f

    fun minOutputHeight(inputVisible: Boolean): Float =
        if (inputVisible) MIN_OUTPUT_WITH_INPUT_DP else MIN_OUTPUT_DP

    /**
     * 输入态在极矮屏上要主动让步：如果可用高度连「220dp 输出 + 120dp 编辑器」都放不下，
     * 就把输出面板压到 150dp，优先保证输入框和编辑器都还在屏幕里。
     */
    fun minOutputHeight(inputVisible: Boolean, availableHeight: Float): Float {
        if (!inputVisible) return MIN_OUTPUT_DP
        val cap = availableHeight - MIN_EDITOR_DP - DRAG_HANDLE_DP
        return MIN_OUTPUT_WITH_INPUT_DP.coerceAtMost(
            cap.coerceAtLeast(COMPACT_OUTPUT_WITH_INPUT_DP)
        )
    }

    /**
     * 当前可用高度下，输出面板允许的最大高度。
     *
     * 注意这里减去的是「编辑器最小高度 + 拖拽把手」，不是屏幕百分比：
     * 键盘弹起后 available 已经扣掉 IME，再按百分比会继续挤压编辑器。
     */
    fun maxOutputHeight(availableHeight: Float): Float {
        val cap = availableHeight - MIN_EDITOR_DP - DRAG_HANDLE_DP
        return cap.coerceAtLeast(MIN_OUTPUT_DP)
    }

    /**
     * 本轮实际渲染高度：优先保留用户偏好，但必须落在
     * [minOutputHeight, maxOutputHeight] 之间。
     */
    fun visibleOutputHeight(
        preferredHeight: Float,
        availableHeight: Float,
        inputVisible: Boolean,
    ): Float {
        val min = minOutputHeight(inputVisible, availableHeight)
        val max = maxOutputHeight(availableHeight).coerceAtLeast(min)
        return preferredHeight.coerceIn(min, max)
    }
}
