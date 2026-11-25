package com.devterminal.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EditorLayoutPolicyTest {

    @Test
    fun `窄屏手机保持上下布局`() {
        assertFalse(EditorLayoutPolicy.useTwoPane(360f, 640f))
        assertFalse(EditorLayoutPolicy.useTwoPane(599f, 720f))
    }

    @Test
    fun `六百 dp 起切换为两栏`() {
        assertTrue(EditorLayoutPolicy.useTwoPane(600f, 800f))
        assertTrue(EditorLayoutPolicy.useTwoPane(840f, 600f))
    }

    @Test
    fun `矮横屏也能两栏`() {
        assertTrue(EditorLayoutPolicy.useTwoPane(568f, 320f))
        assertTrue(EditorLayoutPolicy.useTwoPane(640f, 360f))
        assertFalse(EditorLayoutPolicy.useTwoPane(540f, 720f))
    }

    @Test
    fun `小屏或大字号才收顶栏`() {
        assertTrue(EditorLayoutPolicy.useCompactToolbar(360, 1f))
        assertFalse(EditorLayoutPolicy.useCompactToolbar(480, 1f))
        assertTrue(EditorLayoutPolicy.useCompactToolbar(840, 1.5f))
        assertFalse(EditorLayoutPolicy.useCompactToolbar(840, 1f))
    }

    @Test
    fun `抽屉不会吃掉主界面`() {
        assertEquals(272, EditorLayoutPolicy.drawerWidthDp(360))
        assertEquals(272, EditorLayoutPolicy.drawerWidthDp(840))
        assertEquals(240, EditorLayoutPolicy.drawerWidthDp(280))
        assertEquals(200, EditorLayoutPolicy.drawerWidthDp(220))
    }

    @Test
    fun `快捷动作在大字号下减列`() {
        assertEquals(4, EditorLayoutPolicy.drawerColumns(600, 1f))
        assertEquals(3, EditorLayoutPolicy.drawerColumns(360, 1f))
        assertEquals(3, EditorLayoutPolicy.drawerColumns(600, 2f))
    }
}
