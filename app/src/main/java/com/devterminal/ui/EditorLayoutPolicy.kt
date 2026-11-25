package com.devterminal.ui

/**
 * 主界面的宽度/字号断点。
 *
 * 这些数字只负责「布局决策」，不参与绘制，因此可以单测。
 * 取舍：
 *  - 600dp 是 Material 的 medium 起点；到了它，编辑器与输出面板并排才不会把代码压成一条。
 *  - 480dp 是普通手机与小平板的分界；低于它，顶栏必须收掉次要动作。
 *  - 1.3 倍字体是 200% 字体设置前的预警线；再放大时，图标和标题会先互相挤。
 */
object EditorLayoutPolicy {
    const val TWO_PANE_MIN_WIDTH_DP = 600
    const val COMPACT_TOOLBAR_MAX_WIDTH_DP = 480
    const val COMPACT_TOOLBAR_MIN_FONT_SCALE = 1.3f
    const val DRAWER_MAX_WIDTH_DP = 272
    const val DRAWER_MIN_WIDTH_DP = 200
    private const val DRAWER_WIDTH_FRACTION = 0.86f

    /**
     * 宽屏/平板用左右两栏；普通手机竖屏仍保持上下结构，给代码留高度。
     * 520dp 以上的横屏手机即使没到 600dp，也横向摆放：这时高度通常只有 320dp，
     * 上下叠放会把编辑器压没。
     */
    fun useTwoPane(widthDp: Float, heightDp: Float): Boolean =
        widthDp >= TWO_PANE_MIN_WIDTH_DP || (widthDp > heightDp && widthDp >= 520f)

    /** 小屏或大字号时，顶栏只保留主操作，其余进入「更多」。 */
    fun useCompactToolbar(widthDp: Int, fontScale: Float): Boolean =
        widthDp < COMPACT_TOOLBAR_MAX_WIDTH_DP || fontScale >= COMPACT_TOOLBAR_MIN_FONT_SCALE

    /** 抽屉最宽 272dp，但窄屏上必须给主界面留出至少 14% 的可见区域。 */
    fun drawerWidthDp(widthDp: Int): Int {
        val fraction = (widthDp * DRAWER_WIDTH_FRACTION).toInt()
        return maxOf(DRAWER_MIN_WIDTH_DP, minOf(DRAWER_MAX_WIDTH_DP, fraction))
    }

    /** 快捷动作在窄屏/大字号下改成三列，避免四列文字被压成省略号。 */
    fun drawerColumns(widthDp: Int, fontScale: Float): Int =
        if (widthDp < 480 || fontScale >= 1.5f) 3 else 4
}
