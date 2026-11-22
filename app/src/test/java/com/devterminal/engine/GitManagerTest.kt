package com.devterminal.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * GitManager（JGit 版）的纯 JVM 测试：真实建仓 / 提交 / 状态读取，不碰网络。
 * push/pull 的远程交互需要真实远端，不在单测范围（走用户真机验证）。
 */
class GitManagerTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val git = GitManager()

    @Test
    fun `非仓库目录 status 返回 isRepo=false`() {
        val dir = tmp.newFolder("plain")
        val st = git.status(dir)
        assertFalse(st.isRepo)
        assertEquals("", st.branch)
        assertTrue(st.changes.isEmpty())
    }

    @Test
    fun `init 后分支为 main 且 isRepo 为真`() {
        val dir = tmp.newFolder("proj")
        val msg = git.init(dir, "张三", "z@example.com")
        assertTrue(msg.contains("main"))
        val st = git.status(dir)
        assertTrue(st.isRepo)
        assertEquals("main", st.branch)
    }

    @Test
    fun `commitAll 后工作区干净且最近提交可见`() {
        val dir = tmp.newFolder("proj")
        git.init(dir, "张三", "z@example.com")
        java.io.File(dir, "main.py").writeText("print('hi')\n")

        val before = git.status(dir)
        assertTrue(before.changes.any { it.path == "main.py" && it.statusCode.trim() == "??" })

        val msg = git.commitAll(dir, "first commit", "张三", "z@example.com")
        assertTrue(msg.contains("first commit"))

        val after = git.status(dir)
        assertTrue(after.changes.isEmpty())
        assertEquals(1, after.recentCommits.size)
        assertTrue(after.recentCommits[0].endsWith("first commit"))
    }

    @Test
    fun `修改已跟踪文件状态码为 M`() {
        val dir = tmp.newFolder("proj")
        git.init(dir, "a", "a@b.c")
        java.io.File(dir, "main.py").writeText("x = 1\n")
        git.commitAll(dir, "c1", "a", "a@b.c")
        java.io.File(dir, "main.py").writeText("x = 2\n")

        val st = git.status(dir)
        assertTrue(st.changes.any { it.path == "main.py" && it.statusCode.trim() == "M" })
    }

    @Test
    fun `空提交信息与空远程被前置拦截`() {
        val dir = tmp.newFolder("proj")
        git.init(dir, "a", "a@b.c")
        assertTrue(git.commitAll(dir, "  ", "a", "a@b.c").contains("不能为空"))
        assertTrue(git.push(dir, "  ").contains("远程地址"))
        assertTrue(git.pull(dir, "").contains("远程地址"))
    }

    @Test
    fun `未初始化仓库时操作给出引导而非异常`() {
        val dir = tmp.newFolder("nothing")
        assertFalse(git.commitAll(dir, "m", "a", "a@b.c").contains("已提交"))
        assertFalse(git.push(dir, "https://u:t@example.com/x.git").contains("已推送"))
    }

    @Test
    fun `远程 URL 落盘前剥离 token 但保留主机与路径`() {
        val raw = "https://badhope:ghp_secret123@github.com/badhope/CodePocket.git"
        assertEquals("https://github.com/badhope/CodePocket.git", git.tokenlessUrl(raw))
        assertEquals("https://github.com/badhope/CodePocket.git", git.tokenlessUrl("https://github.com/badhope/CodePocket.git"))
        assertEquals("ssh://git@github.com/badhope/CodePocket.git", git.tokenlessUrl("ssh://git@github.com/badhope/CodePocket.git"))
    }
}
