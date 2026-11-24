package com.devterminal.ui

/**
 * 当前覆盖在编辑器之上的面板。
 *
 * 为什么要收敛成一个密封类：
 * 原先 EditorScreen 里散落着 9 个互相独立的 `var showXxx by remember { mutableStateOf(false) }`。
 * 这会带来三个真实问题：
 *  1. **可以同时为 true**——理论上能叠加出两层弹窗，视觉上会互相压盖；
 *  2. **打开时的副作用容易漏**——比如打开 Git 面板必须先刷新状态，
 *     这个动作原本和 `showGit = true` 写在不同地方，加新面板时极易忘记；
 *  3. **返回键无法统一处理**——只能逐个判断，加一个忘一个。
 *
 * 收敛成「同一时刻至多一个面板」后，上面三件事都变成结构上不可能出错。
 */
sealed interface Overlay {
    /** 无面板 */
    data object None : Overlay

    /** 命令面板（⌘K） */
    data object Palette : Overlay

    /** 新建项目 */
    data object NewProject : Overlay

    /** Git 仓库 */
    data object Git : Overlay

    /** AI 助手 */
    data object Ai : Overlay

    /** Agent 模式：可读写项目的工具循环 */
    data object Agent : Overlay

    /** 全局搜索 */
    data object GlobalSearch : Overlay

    /** 当前文件符号大纲 */
    data object Symbols : Overlay

    /** 跨文件定义候选（Python，v0.0.27） */
    data object Definitions : Overlay

    /** 本地模型下载与管理 */
    data object LocalModels : Overlay

    /** Agent 历史会话回放 */
    data object AgentHistory : Overlay

    /** 轻量命令终端 */
    data object Terminal : Overlay

    /** 环境自检 */
    data object Diagnostics : Overlay

    /** 运行配置（参数 / 主类） */
    data object RunConfig : Overlay

    /** 设置 */
    data object Settings : Overlay

    /** 关于 */
    data object About : Overlay

    /** 新建文件（在当前项目根目录） */
    data object NewFile : Overlay

    /** 新建文件夹（在当前项目根目录） */
    data object NewFolder : Overlay

    /** 切换项目 */
    data object SwitchProject : Overlay

    /** 跳转到行 */
    data object GotoLine : Overlay

    /** 离线包管理（查看内置库 / 安装本地 wheel） */
    data object Packages : Overlay

    /** 首次启动的引导（工具链就绪但尚未打开任何文件时出现） */
    data object Onboarding : Overlay

    /**
     * 文件操作（重命名 / 删除）。
     * 与其余面板不同，它需要携带目标文件，所以是唯一带参数的分支。
     */
    data class FileAction(val path: String) : Overlay
}

/**
 * 一次「滚动编辑器到指定行」的请求。
 *
 * 用自增序号作为触发信号：同一个行号连点两次也要各生效一次，
 * 若只比较行号本身，第二次点击不会产生状态变化，编辑器就不会响应。
 */
data class ScrollToLineRequest(val line: Int, val seq: Long, val col: Int = 0)
