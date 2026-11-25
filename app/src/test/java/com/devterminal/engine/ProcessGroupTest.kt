package com.devterminal.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * 只验证「包装 shell → pidfile → exec 命令」这条链路在 JVM 上成立。
 * 真机上的 setsid / 负 PID 信号仍需要 Android 运行时验收。
 */
class ProcessGroupTest {

    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun `wrapper writes pid and runs the real command`() {
        val handle = ProcessGroup.start(
            shell = "/bin/sh",
            command = "printf 'process-group-ok'",
            cwd = temp.root,
            redirectErrorStream = true,
        )

        val output = handle.process.inputStream.bufferedReader().use { it.readText() }
        assertEquals(0, handle.process.waitFor())
        assertTrue(output, output.contains("process-group-ok"))
        assertTrue("pid should be captured, got ${handle.pid}", handle.pid > 0)
    }
}
