package com.devterminal.engine

import org.eclipse.jgit.api.Git
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider
import java.io.File

/**
 * Git 操作管理（JGit 版）。
 *
 * ## 为什么是 JGit
 * JGit 是纯 Java 实现，无需系统 git 二进制，随 APK 打包即用：
 * init / status / commit / push / pull 全部在应用进程内完成，依旧零联网依赖
 * （push/pull 走用户配置的远程地址，与桌面端 git 同理）。
 *
 * ## 接口约定
 * 与旧版（git CLI）完全一致，UI 层（GitPanel / ViewModel）零改动。
 * 所有方法返回用户可读的中文字符串，成功与失败都不抛异常到 UI 层。
 */
class GitManager {

    /** 仓库状态快照 */
    data class GitStatus(
        val isRepo: Boolean,
        val branch: String,
        val changes: List<Change>,
        val ahead: Int = 0,
        val behind: Int = 0,
        val recentCommits: List<String> = emptyList()
    )

    data class Change(val statusCode: String, val path: String)

    /** JGit 纯 Java，随 APK 分发，天然可用 */
    fun isGitInstalled(): Boolean = true

    /** 打开目录对应的仓库；不是仓库或打开失败返回 null */
    private fun openOrNull(dir: File): Git? =
        if (!File(dir, ".git").exists()) null
        else runCatching { Git.open(dir) }.getOrNull()

    /** 读取仓库状态：分支 / 变更列表 / 领先落后 / 最近提交 */
    fun status(dir: File): GitStatus {
        val git = openOrNull(dir) ?: return GitStatus(isRepo = false, branch = "", changes = emptyList())
        return git.use { g ->
            runCatching {
                val st = g.status().call()
                // 状态码沿用 git CLI 惯例：?? 未跟踪；第一列暂存区，第二列工作区
                val changes = buildList {
                    st.added.forEach { add(Change("A ", it)) }
                    st.changed.forEach { add(Change("M ", it)) }
                    st.removed.forEach { add(Change("D ", it)) }
                    st.modified.forEach { add(Change(" M", it)) }
                    st.missing.forEach { add(Change(" D", it)) }
                    st.untracked.forEach { add(Change("??", it)) }
                }
                val branch = g.repository.branch ?: "HEAD"
                var ahead = 0
                var behind = 0
                runCatching {
                    org.eclipse.jgit.lib.BranchTrackingStatus.of(g.repository, branch)?.let {
                        ahead = it.aheadCount
                        behind = it.behindCount
                    }
                }
                // 刚 init、还没有首次提交时 HEAD 未出生，log() 会抛 NoHeadException——
                // 这属于「仓库正常但暂无提交」，不能让整个 status 被它吞掉
                val commits = runCatching {
                    g.log().setMaxCount(3).call()
                        .map { "${it.name().take(7)} ${it.shortMessage}" }
                        .toList()
                }.getOrDefault(emptyList())
                GitStatus(true, branch, changes, ahead, behind, commits)
            }.getOrElse { GitStatus(isRepo = false, branch = "", changes = emptyList()) }
        }
    }

    /** 初始化仓库（分支固定 main，与 UI 文案一致），并写入用户身份 */
    fun init(dir: File, userName: String, userEmail: String): String =
        guarded("初始化") {
            Git.init().setDirectory(dir).setInitialBranch("main").call().use { g ->
                saveIdentity(g, userName, userEmail)
                "已初始化仓库（分支 main）· 身份 ${userName.ifBlank { "devterminal" }}"
            }
        }

    /**
     * 把远程仓库克隆到 targetDir。
     *
     * targetDir 必须不存在或为空；调用方负责分配不冲突的目录。克隆全程走 JGit，
     * 不启动系统 git，也不把带 token 的 URL 写进 `.git/config`。
     */
    fun cloneInto(targetDir: File, remoteUrl: String): String {
        if (remoteUrl.isBlank()) return "远程地址不能为空"
        if (targetDir.exists() && (targetDir.isDirectory && targetDir.listFiles()?.isNotEmpty() == true ||
                targetDir.isFile)
        ) {
            return "目标目录不是空目录：${targetDir.name}"
        }
        targetDir.parentFile?.mkdirs()
        return guarded("克隆") {
            val cmd = Git.cloneRepository()
                .setURI(tokenlessUrl(remoteUrl))
                .setDirectory(targetDir)
                .setCloneAllBranches(true)
            credentials(remoteUrl)?.let { cmd.setCredentialsProvider(it) }
            cmd.call().use { g ->
                val branch = runCatching { g.repository.branch }.getOrNull() ?: "HEAD"
                "已克隆 ${hostOf(remoteUrl)} · 分支 $branch"
            }
        }
    }

    /** 暂存全部变更并提交（含删除） */
    fun commitAll(dir: File, message: String, userName: String, userEmail: String): String {
        if (message.isBlank()) return "提交信息不能为空"
        val git = openOrNull(dir) ?: return "还不是 Git 仓库：请先「初始化仓库」"
        return git.use { g ->
            guarded("提交") {
                g.add().addFilepattern(".").call()
                if (g.status().call().isClean) {
                    "没有可提交的变更（工作区干净）"
                } else {
                    val cmd = g.commit().setMessage(message.trim()).setAll(true)
                    if (userName.isNotBlank()) {
                        cmd.setAuthor(userName, userEmail.ifBlank { "dev@terminal.local" })
                    }
                    val rev = cmd.call()
                    "已提交 ${rev.name().take(7)}：${message.trim()}"
                }
            }
        }
    }

    /** 推送到远程（remoteUrl 支持 https://user:token@host/repo.git 内嵌凭据） */
    fun push(dir: File, remoteUrl: String): String {
        if (remoteUrl.isBlank()) return "尚未配置远程地址：在下方「配置身份 / 远程」里填写"
        val git = openOrNull(dir) ?: return "还不是 Git 仓库：请先「初始化仓库」"
        return git.use { g ->
            guarded("推送") {
                ensureRemote(g, tokenlessUrl(remoteUrl))
                val cmd = g.push().setRemote("origin")
                credentials(remoteUrl)?.let { cmd.setCredentialsProvider(it) }
                val updates = cmd.call().asSequence()
                    .flatMap { it.remoteUpdates }
                    .joinToString("，") { "${it.remoteName}:${it.status}" }
                "已推送到 ${hostOf(remoteUrl)}${if (updates.isBlank()) "" else " · $updates"}"
            }
        }
    }

    /** 拉取并合并远程分支 */
    fun pull(dir: File, remoteUrl: String): String {
        if (remoteUrl.isBlank()) return "尚未配置远程地址：在下方「配置身份 / 远程」里填写"
        val git = openOrNull(dir) ?: return "还不是 Git 仓库：请先「初始化仓库」"
        return git.use { g ->
            guarded("拉取") {
                ensureRemote(g, tokenlessUrl(remoteUrl))
                val cmd = g.pull().setRemote("origin")
                credentials(remoteUrl)?.let { cmd.setCredentialsProvider(it) }
                val result = cmd.call()
                val mergeStatus = result.mergeResult?.mergeStatus
                if (mergeStatus == org.eclipse.jgit.api.MergeResult.MergeStatus.CONFLICTING) {
                    // 合并冲突：列出冲突文件，提示用户手动解决后再提交
                    val conflicts = runCatching { g.status().call().conflicting }
                        .getOrDefault(emptySet())
                    val listed = conflicts.joinToString("\n") { "- $it" }
                    "⚠️ 拉取完成（${hostOf(remoteUrl)}）但存在合并冲突，" +
                        "请手动解决以下文件后再提交：\n$listed"
                } else {
                    val merge = mergeStatus?.toString() ?: "已完成"
                    "拉取完成（${hostOf(remoteUrl)}）· 合并：$merge"
                }
            }
        }
    }

    // ---------- 内部工具 ----------

    /** 统一兜底：JGit 异常转用户可读文案，不让 UI 层接异常 */
    private inline fun guarded(action: String, block: () -> String): String = try {
        block()
    } catch (e: Exception) {
        val reason = e.message?.lineSequence()?.firstOrNull()?.take(160) ?: e.javaClass.simpleName
        "${action}失败：$reason"
    }

    /** 写入 user.name / user.email，保证 commit 在未配置全局 gitconfig 时也能完成 */
    private fun saveIdentity(g: Git, userName: String, userEmail: String) {
        val cfg = g.repository.config
        cfg.setString("user", null, "name", userName.ifBlank { "CodePocket" })
        cfg.setString("user", null, "email", userEmail.ifBlank { "dev@terminal.local" })
        cfg.save()
    }

    /**
     * 只把去掉 userinfo 的 URL 写进 .git/config。
     * token 只存在加密设置里，运行时通过 CredentialsProvider 传入，绝不明文落盘。
     */
    internal fun tokenlessUrl(url: String): String =
        url.trim().replaceFirst(Regex("^(https?://)[^/@]+:[^@]*@"), "$1")

    /** origin 不存在或地址变化时写入 URL 与 fetch 规则 */
    private fun ensureRemote(g: Git, remoteUrl: String) {
        val cfg = g.repository.config
        if (cfg.getString("remote", "origin", "url") != remoteUrl) {
            cfg.setString("remote", "origin", "url", remoteUrl)
            cfg.setString("remote", "origin", "fetch", "+refs/heads/*:refs/remotes/origin/*")
            cfg.save()
        }
    }

    /**
     * 从 URL 提取内嵌凭据（https://user:token@…）。
     * JGit 不会自动采用 URL 里的 userinfo，必须显式转成 CredentialsProvider。
     */
    private fun credentials(remoteUrl: String): UsernamePasswordCredentialsProvider? {
        val m = Regex("^(https?://)([^/@:]+):([^@]*)@(.+)$").find(remoteUrl.trim()) ?: return null
        val (_, _, user, pass) = m.groupValues
        return UsernamePasswordCredentialsProvider(user, pass)
    }

    /** 只取主机名用于结果回显，不回显完整 URL（避免把内嵌 token 打到屏幕上） */
    private fun hostOf(remoteUrl: String): String = runCatching {
        java.net.URI(remoteUrl.trim().replaceFirst(Regex("^(https?://)[^/@]+@"), "$1")).host
    }.getOrNull() ?: "远程"
}
