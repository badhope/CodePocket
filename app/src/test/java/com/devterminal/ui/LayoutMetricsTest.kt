package com.devterminal.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class LayoutMetricsTest {

    @Test
    fun `keyboard shrinks visible height without shrinking preference`() {
        val preferred = 360f
        val beforeKeyboard = LayoutMetrics.visibleOutputHeight(
            preferredHeight = preferred,
            availableHeight = 640f,
            inputVisible = false,
        )
        val duringKeyboard = LayoutMetrics.visibleOutputHeight(
            preferredHeight = preferred,
            availableHeight = 360f,
            inputVisible = false,
        )

        assertEquals(360f, beforeKeyboard, 0f)
        // 360 可用高：120 编辑器 + 14 把手，输出最多 226。
        assertEquals(226f, duringKeyboard, 0f)
    }

    @Test
    fun `input row reserves enough height for keys`() {
        val visible = LayoutMetrics.visibleOutputHeight(
            preferredHeight = 120f,
            availableHeight = 600f,
            inputVisible = true,
        )
        assertEquals(LayoutMetrics.MIN_OUTPUT_WITH_INPUT_DP, visible, 0f)
    }

    @Test
    fun `tiny landscape never drives editor below zero`() {
        val visible = LayoutMetrics.visibleOutputHeight(
            preferredHeight = 500f,
            availableHeight = 300f,
            inputVisible = false,
        )
        val max = LayoutMetrics.maxOutputHeight(300f)
        assertEquals(max, visible, 0f)
        assertEquals(166f, max, 0f)
    }

    @Test
    fun `short preference is raised to minimum`() {
        val visible = LayoutMetrics.visibleOutputHeight(
            preferredHeight = 60f,
            availableHeight = 640f,
            inputVisible = false,
        )
        assertEquals(LayoutMetrics.MIN_OUTPUT_DP, visible, 0f)
    }

    @Test
    fun `input row yields on very short screens`() {
        val visible = LayoutMetrics.visibleOutputHeight(
            preferredHeight = 500f,
            availableHeight = 300f,
            inputVisible = true,
        )
        // 300 - 120 编辑器 - 14 把手 = 166，低于输入态常规下限 220，但高于紧凑下限 150。
        assertEquals(166f, visible, 0f)
    }

    @Test
    fun `unusually short available height clamps to minimum`() {
        val visible = LayoutMetrics.visibleOutputHeight(
            preferredHeight = 240f,
            availableHeight = 120f,
            inputVisible = false,
        )
        assertEquals(LayoutMetrics.MIN_OUTPUT_DP, visible, 0f)
    }
}
