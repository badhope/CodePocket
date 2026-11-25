package com.devterminal.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PreviewLimiterTest {

    @Test
    fun `短文本原样返回`() {
        val r = PreviewLimiter.limit("# hello")
        assertEquals("# hello", r.text)
        assertFalse(r.truncated)
    }

    @Test
    fun `超过上限只截预览不改原文语义`() {
        val text = "x".repeat(PreviewLimiter.MAX_CHARS + 10)
        val r = PreviewLimiter.limit(text)
        assertTrue(r.truncated)
        assertEquals(PreviewLimiter.MAX_CHARS, r.text.length)
        assertEquals(text.length, r.originalChars)
    }
}
