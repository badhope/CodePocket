# 更新日志（Changelog）

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.0.34] — 2026-11-25

### 新增

- **从 Git 克隆**：`GitManager.cloneInto` 用 JGit 克隆 HTTPS 远程到新项目；地址中的 `user:token` 拆到 `UsernamePasswordCredentialsProvider`，克隆 URL 不含凭据，避免 token 写入 `.git/config`。目标目录必须不存在或为空，失败删除半成品。
- **项目 zip 导入/导出**：`ProjectArchive` 流式读写 zip。导出跳过 `.git`、`build`、`dist`、`node_modules`、`__pycache__`、`.gradle`、`.idea` 与符号链接，上限 256MB；导入先落临时目录，逐条 canonical path 校验，拒绝绝对路径、`..`、Windows 盘符、空路径，限制 10,000 条目 / 单文件 48MB / 总解压 256MB，单顶层目录自动提升，重名自动加 `-1`/`-2`。
- **项目迁移入口**：项目列表新增「从 Git 克隆」「导入 ZIP」「导出当前项目」；启动页与命令面板同步接入，导出/导入使用 SAF，不申请存储权限。

### 修复

- **forkpty 子进程 async-signal-safe**：`ptybridge.c` 在 `forkpty` 前构造 `argv`/`envp`，过滤旧 `TERM`/`PS1` 并追加终端环境；子进程只 `chdir` + `execve`，不再在 `pid==0` 分支调用 `setenv`。
- **命令子进程组回收**：新增 `ProcessGroup`，用 pidfile 记录 shell PID，经 `/system/bin/setsid` 进入新会话，超时先 `SIGTERM` 负 PID，300ms 后 `SIGKILL`；`setsid` 缺失时退回直接子进程。`RunCommandTool` 与 `TerminalSession` 已接入。
- **引擎卡死恢复入口**：`NativeEngine.isBusy` 暴露 busy；`stopRun()` 8 秒后仍占用时置 `engineStuck`，输出面板显示「重启应用」；`restartApp()` 同步保存当前文件，`AlarmManager` 约 900ms 后重新拉起再杀进程。

### 边界

- `engineStuck` 是恢复入口，不是解释器进程隔离；脚本卡在不可中断 C 调用时 `busy` 仍不会复位，只能重启应用。
- `ProcessGroup` 依赖 `/system/bin/setsid` 与负 PID 信号，不同 ROM 的 SELinux/二进制差异未做真机验证。
- 0.0.34 的 clone/zip UI、`restartApp`、PTY execve 均未取得 Android 真机/模拟器运行验收。

### 构建

- `versionCode 34` / `versionName 0.0.34`。
- release APK **24,293,808 B**，SHA-256 `6d2b056a875c52a84d445e652f4d3421ea8975c278813139a4b77aa3ae8b75c6`；debug APK **43,975,164 B**，SHA-256 `8020214efa14b842086688a4a0b0779642a30e8daad0786f53c8fb39d3cd3249`。
- JVM 单测 **144 通过 / 0 失败 / 0 错误**，lintRelease **0 Error / 22 Warning**；两包 `versionCode=34`、正式 release 证书 SHA-256 `1b02135746d1426d7beda47e706fdb2c77a7145ea41e0f7e14addb191b87fac5`，`zipalign -c -p 4` 通过。
- release APK 解压 **55,629,297 B / 1,138 文件**；`assets/python-stdlib.zip` 4,534,942 B / 574 文件；两个 ABI 的 `libptybridge.so` 均按 16KB 页对齐。

## [0.0.33] — 2026-11-25

### 修复

- **ViewModel 销毁统一收尾**：补 `onCleared`，取消 AI/Agent/模型下载/光标保存 Job，停止 PTY，释放 NativeEngine 与 RuntimeRegistry；返回桌面或系统回收 Activity 后不再把解释器和终端留在进程里。
- **会话列表不再整份读日志**：`AgentSessionStore.metaOf` 从 `useLines { it.toList() }` 改为单遍流式读取，首行取 meta、其余行累计事件数与结束标记；单份 16MB 日志不再整份进内存。
- **删除项目返回真实结果**：`ProjectManager.deleteProject` 返回 `deleteRecursively()` 的 Boolean，UI 不再把「调用没抛异常」误判成「删干净」。
- **PTY 输入有界**：输入队列从 `UNLIMITED` 改为 256 容量；单次写入超过 64KB 截断并提示，队列满时丢弃本次按键并提示，避免大段粘贴或连发把内存拉爆。

### 构建

- `versionCode 33` / `versionName 0.0.33`。
- release APK **24,282,804 B**，SHA-256 `a7975da1fab365c347b0515f9a65c9f7b344b98d2695f8a7f7d14badbad3e23d`；debug APK **43,361,838 B**，SHA-256 `1c977b0eaa6b350e566f538562875f60a69a07821d8bdd2ad1645954dcbd8111`。
- JVM 单测 **137 通过**，lintRelease **0 Error / 23 Warning**；两包均通过 `versionCode=33`、双 ABI 与签名证书校验。

## [0.0.32] — 2026-11-25

### 修复

- **移除旧工具链残留说明**：删除 `app/src/main/assets/README.txt`。该文件仍在教用户下载 441MB 的 `usrtar.zip`，属于已废弃的 Termux 方案；当前运行时是原生 CPython + JGit，继续随 APK 分发会误导用户以为安装包漏文件。
- **标准库瘦身**：`scripts/package_native.sh` 打包时剔除 `test`、`idlelib`、`turtledemo` 三个目录，共 1,740 个文件、约 7.1MB 压缩体积；`python-stdlib.zip` 从 11.43MB 降到 4.32MB。运行时模块、`ensurepip` 与 53 个 C 扩展均未改动。
- **修正 Git 能力表述**：官网与文档不再写“完整 Git 能力”，改为实际支持的 init / commit / push / pull；clone 尚未实现，避免过度承诺。
- **修正官网链接**：README 的 Website 链接从 `x33834.github.io` 改为实际部署的 `badhope.github.io`。

### 构建

- `versionCode 32` / `versionName 0.0.32`。
- release APK **24,284,004 B**，SHA-256 `4dd471de80afd7fcd11f4e40a086e408788e31293c1f0d5835c3c0f40e44697d`；debug APK **43,360,958 B**，SHA-256 `46403e44938788b397400748e9907fd0ee754c62180060babe3d29ce02a124df`。
- `python-stdlib.zip` 从 11.43MB 降到 4.32MB，APK 解压内容 55.6MB / 1,138 文件。
- JVM 单测 **137 通过**，lintRelease **0 Error / 37 Warning**；两个包均通过签名与 `versionCode=32` 校验。

## [0.0.31] — 2026-11-25

### 修复

- **关闭自动保存后不再静默丢改动**：切文件、关 Tab、切项目前弹出「保存并继续 / 不保存直接继续 / 取消」；`autoSave=false` 的脏文本不会被新文件覆盖。
- **写入改为原子落盘**：`ProjectManager.write`、`LocalWorkspace.writeBytes`、`CheckpointStore.writeAtomic` 统一临时文件 + fsync + rename；崩溃/断电最多保留旧版本，不再留下半个文件。
- **切后台保存改为同步**：`onStop` 不再只 launch 异步写，进程在写盘前被杀也不会丢掉当前快照。
- **文件打开护栏**：编辑器单文件上限 5MB，二进制文件拒绝按文本打开；超大文件/读失败给出提示，不再闪退。
- **Agent 检查点回收**：快照单文件 8MB 上限，保留最近 20 份清单并删除无引用 blob；反复修改/撤销不再无限吃存储。
- **Agent 会话日志封顶**：单会话 16MB、回放 2000 条、总量 128MB；长任务不会把手机写满。
- **PTY 输入严格 FIFO**：xterm 逐键回调改单消费者队列，快速输入不再乱序；返回键关终端会真正停止 PTY，关闭 Agent 面板会取消后台 Agent。
- **Agent 覆盖保护**：Agent 改完文件后，当前编辑器有未保存修改时不自动用磁盘内容覆盖；撤销检查点也先要求保存/关闭。
- **目录重命名/删除的 Tab 生命周期**：目录下已打开 Tab 会随路径迁移；删除目录会清空其下当前文件和 Tab，`dirty` 复位。
- **文件树节点上限**：单次构建最多 10,000 节点，避免超大项目把 UI 卡死（截断暂不在界面提示，已记录）。
- **后台执行更稳**：`ExecutionService.stop` 改为同进程直接停实例，避开 Android O+ 后台 `startService` 限制；运行时申请 partial wakelock，熄屏长脚本不被挂起。
- **JNI 异常清理**：PTY 字节回调抛异常后立即 `ExceptionClear`，避免后续 JNI 调用连锁失败。
- **分享/输出上限**：分享与剪贴板 200KB 截断，输出单行 4000 字符截断，避免 Binder 事务超限与超大单行 OOM。
- **编辑器手势**：双指捏合只在两指及以上消费事件，单指滚动/光标拖动不再被手势层抢走。
- **状态栏图标跟随主题**：App 内切深色/浅色后同步状态栏与导航栏图标明暗。
- **AI 响应上限**：非流式响应最多读 2MB 字符，异常端点不会把内存打爆。
- **运行命令超时**：`RunCommandTool` 超时强杀并关闭输出流；Android 无 `ProcessHandle`，子进程树彻底回收仍待下一批。

### 边界

- 本轮仍无 Android 真机/模拟器交互验收；x86_64 TCG 继续卡在 `emulator-5556 offline`，PTY、WebView、IME 和 16KB 页需要 ARM64 真机确认。
- 未处理项：不响应中断的 Python 脚本仍可能让引擎 `busy` 卡死、`forkpty` 子进程 `setenv` 的 async-signal 风险、项目 zip 导入/导出、UI 截图回归、字体 200% 可访问性。完整清单见 `docs/RISK_REGISTER_0.0.31.md` 与交付报告。

### 构建

- `versionCode 31` / `versionName 0.0.31`。
- JVM 单测 **137 个通过**（新增 1 个检查点 blob 回收测试）。
- lint Release **0 Error / 37 Warning**，无 Fatal。

## [0.0.30] — 2026-11-24

### 新增

- **手机端遮挡治理**：统一所有面板为 edge-to-edge `Dialog`，外层一次性吃掉状态栏、导航栏与软键盘 inset；卡片最大高度等于键盘上方可用高度。标题、footer 输入框和底部按钮固定，只有正文滚动，长设置/长对话不再把输入框或按钮顶出屏幕。
- **终端全屏自适应**：终端面板从固定 330dp 对话框改为全屏可伸缩布局。PTY 主体用 `weight(1f)` 吃掉键盘上方空间，Esc/Tab/Ctrl/方向键条固定贴在键盘上方；非 PTY 的输入框固定在底部，长输出不会把它滚走。
- **键盘不再误触发布局切换**：横竖屏判断从「内容区宽高比」改为系统 `Configuration.orientation`。软键盘把可用高度压矮时，竖屏手机不会突然变成左右分栏，避免界面重排造成遮挡。
- **输出面板高度分离偏好与可见值**：用户拖出的高度（preferred）与当前键盘/横屏下的可见高度（visible）分开计算；键盘弹起只临时夹取 visible，不写回设置，键盘收起后编辑器恢复原高度。展开 stdin 输入行时通常保留 220dp；极矮屏自动降到 150dp，优先保证输入框和编辑器都在屏内，并收起 40dp 的大运行按钮。
- **底部状态栏归位**：状态栏移入 `Scaffold.bottomBar`，Snackbar 自动落在它上方，不再盖住行号/保存状态或终端按键条。

### 改变

- **对话框**：`QuietDialog` 改为自定义 edge-to-edge `Dialog`，手机宽度占满左右 16dp，平板最大 560dp；正文滚动、footer 与按钮固定。AI 助手和 Agent 的输入框移入 footer，键盘弹起时始终可见。
- **命令面板**：列表高度改为自适应，最大 380dp；键盘弹起时整体留在键盘上方，不越过屏幕。
- **小屏细节**：顶栏文件名/语言标签改为单行省略；状态栏左侧信息可横向滚动、「已保存」固定贴右；输出头状态单行省略；Tab 名最大 180dp；AI 快捷动作与输出方向键改为横向滚动；编辑器在 IME inset 变化时重新把光标滚回可视区。

### 边界

- 本轮未取得 Android 真机/模拟器交互验收：x86_64 TCG 在单核模式下仍停在 `emulator-5556 offline`，未完成开机；没有伪造运行截图。布局与 inset 逻辑通过 Kotlin 编译、136 个 JVM 单测和 lint 验证，Android WebView/IME 的最终触感仍需真机确认。
- edge-to-edge Dialog 依赖 Android 的 WindowInsets 分发；极老机型或自定义 ROM 若不上报 IME inset，仍可能出现键盘覆盖，需要在设置里手动收起键盘作为兜底。

### 构建

- `versionCode 30` / `versionName 0.0.30`。
- 单元测试 **136 个通过**（新增 6 个 `LayoutMetrics` 测试），0 failures / 0 errors。
- release APK **31,722,051 B（约 30.3MiB）**，SHA-256 `de3d41a6419a2820c30ab2ec6892da3280797097b9b6a41aa50f56184dec16dc`；debug APK **51,337,601 B（约 49.0MiB）**，SHA-256 `de5220970bc299324f9ebdcb88bb60924c1c023b4a30f096079c4a6d1df9a508`。
- lint Release **36 Warning + 2 Information**，Fatal 0 / Error 0。
- 签名证书不变：`CN=CodePocket`，SHA-256 `1b02135746d1426d7beda47e706fdb2c77a7145ea41e0f7e14addb191b87fac5`。
- APK 仍包含 `assets/terminal/` 的 xterm.js 5.5.0 与双 ABI `libptybridge.so`。

## [0.0.29] — 2026-11-24

### 新增

- **ANSI 终端模拟器**：把 0.0.28 的「行式 PTY」升级为本地 xterm.js 5.5.0（MIT，随 APK 打包在 `assets/terminal/`）。PTY 原始字节直接写入 xterm，光标定位、颜色、清屏、备用屏、滚动回看与全屏重绘都由终端模拟器解释；`vim`、`top`、`less` 等程序可以正常显示。
- **窗口尺寸联动**：xterm 用 `FitAddon` 按容器计算行列，变化时经 JS 桥回调 `PtyBridge.resize`，shell 收到真实 `TIOCSWINSZ`。
- **移动端补充键**：终端下方提供 Esc / Tab / Ctrl-C / Ctrl-D / 方向键与「清屏」，解决软键盘没有这些键的问题。
- **亮暗双主题**：xterm 配色随应用 `effectiveDarkTheme()` 切换；WebView 强制 `blockNetworkLoads` 且拦截外部跳转，终端页不联网。

### 改变

- `EditorViewModel` 不再在 Kotlin 侧做 UTF-8 解码、按行切分、剥离 CSI/OSC；PTY 字节进 `MutableSharedFlow<ByteArray>`（replay 64）后交给 xterm，避免无换行提示符与全屏程序被吞。
- 终端面板在 PTY 模式下隐藏原来的单行输入框，键盘输入直接进 xterm；非 PTY 的轻量命令会话保持不变。

### 边界

- 终端渲染依赖系统 WebView（Android 8.0+ 自带）。WebView 被禁用/损坏时 PTY 仍能启动，但终端页面无法显示；这是当前为「成熟终端模拟器」付出的体积与依赖代价（xterm 资产约 296KB）。
- 本轮未取得 Android 真机/模拟器交互验收：TCG 模拟器仍受 QEMU hanging thread 影响；xterm 页面已用 Chromium 无头浏览器做 ANSI/主题/无报错冒烟，PTY 字节链路沿用 0.0.28 的宿主 `forkpty` 验证。

### 构建

- `versionCode 29` / `versionName 0.0.29`。
- 单元测试 130 个通过（本轮无新增 JVM 测试；新增 xterm 页面冒烟为构建外验证）。
- release APK 31,725,827 B（约 30.3MiB），SHA-256 `e4ff73ea6bbeb011137f5627db12197a06cf7a0d0232fa4e535ccb9721d6640f`；debug APK 51,315,765 B（约 48.9MiB），SHA-256 `d10e6668497fbe9d68d87aa1849b307c3b867f319b59a70b0245821e5482534a`。
- lint Release 38 个 issue（36 Warning + 2 Information），Fatal 0 / Error 0。
- APK 内 `assets/terminal/` 含 `index.html`、`xterm.js`、`xterm.css`、`addon-fit.js`、`LICENSE-xterm.txt`；`lib/arm64-v8a/libptybridge.so`、`lib/x86_64/libptybridge.so` 仍在。

## [0.0.28] — 2026-11-24

### 新增

- **Python pdb 调试**：顶栏新增调试图标，命令面板新增「调试当前文件」。用原生 CPython 标准库 `pdb` 启动：第一行即停，支持 `b <行号>` 断点、`n` 下一步、`s` 进入、`c` 继续、`p locals()` 看变量、`w` 看调用栈、`q` 退出。输出面板提供「继续 / 下一步 / 进入 / 变量 / 栈 / 断点 / 退出」快捷条，命令走同一个 stdin。
- **真实 PTY 终端**：新增 `libptybridge.so`（arm64-v8a / x86_64），用 `forkpty` + `/system/bin/sh -i` 起交互式 shell。终端面板新增「PTY 交互模式（vim / top）」开关；`isatty` 为真，`vim`、`top` 等依赖 tty 的程序可以启动。
- **输入提示即时刷新**：`NativeBridge.onInputLine()` 在阻塞等待输入前 flush 未完结输出，修复 pdb/交互程序 `write("(Pdb) ")` 后提示符不显示、用户面对空白等待的问题。

### 边界

- pdb 是终端式调试，不是图形化 DAP：没有变量树/断点列表/图形调用栈；调试期间目标程序自身的 `input()` 与 pdb 命令共用 stdin，交互式输入程序不建议调试。
- PTY 是真实终端后端，UI 不是 ANSI 终端模拟器：输出会剥离 CSI/OSC 转义并按行显示，全屏程序的光标定位、颜色与重绘不会解释。
- PTY 在宿主 `forkpty` 冒烟测试通过；Android 端本轮未取得真机/模拟器交互验收（0.0.27 的 x86 TCG 首次启动仍受 System UI ANR 影响）。

### 构建

- `versionCode 28` / `versionName 0.0.28`。
- 单元测试 130 个通过（新增 1 个 pdb 包装器测试）。
- release APK 约 31MB，SHA-256 `7f3b77a9c5afa0398161a883705873d8cf99c6d0f30859c2ab39fe243236d35e`；debug APK 约 49MB，SHA-256 `21682e8adcc9b5bd72b7c8d66676c88f0daa06b623aa86634f1a4fe0a9e6deca`。
- lint Release 38 个 issue（36 Warning + 2 Information），Fatal 0 / Error 0。
- APK 内含 `lib/arm64-v8a/libptybridge.so`、`lib/x86_64/libptybridge.so`，与 `libpybridge.so` 并列。

## [0.0.27] — 2026-11-24

### 新增

- **跨文件 Python 定义跳转**：命令面板新增「跳转到定义」，读取光标下的标识符，在项目内扫描 `.py` 文件的 `class` / `def` / 模块级变量定义，列出文件、行号与签名，点选后直接打开对应文件并定位到行。
- **import 优先排序**：`from utils import helper` / `import pkg.utils` 会优先匹配对应模块文件；同名符号仍全部列出，不替用户猜。
- **定义索引导航**：新增 `DefinitionDialog`，与符号大纲共用同一套离线、零进程的交互；索引上限 300 个 `.py`、单文件 512KB，避免手机端卡顿。

### 边界

- 这不是 LSP：不做类型推断、继承解析、跨文件引用重命名或后台语言服务器；只做稳定的文本级定义定位。
- 当前只支持 Python。Kotlin / Java / JS / TS / Lua 仍使用原有当前文件符号大纲。

### 构建

- `versionCode 27` / `versionName 0.0.27`。
- 单元测试 129 个通过（新增 5 个定义索引测试）。
- release APK 约 31MB，SHA-256 `59053f190d5ddbca64e2770da44583bb69d155141a7c136c754348ec6bcc097e`；debug APK 约 49MB，SHA-256 `3e9a61ef7f158cb5de519240d5bd8d39d0ea905e194f88f0cf242a4c4978f31b`。
- lint Release 38 个 issue（36 Warning + 2 Information），Fatal 0 / Error 0。
- x86_64 模拟器未在本轮重跑；0.0.26 的安装、Python 运行、自检、终端结果仍有效。0.0.27 新增的是离线文本索引与 UI，不改变原生运行时。

## [0.0.26] — 2026-11-24

### 新增

- **正式签名**：release 构建使用独立 RSA-4096 证书（`CN=CodePocket`），签名配置从根目录 `keystore.properties` 读取；密钥与密码不入库，仓库只保留 `keystore.properties.example`。新证书与旧 debug 签名不兼容，旧版需卸载重装。
- **x86_64 支持**：新增 x86_64 CPython 3.13 交叉编译产物、`libpybridge.so`、53 个 C 扩展与 OpenSSL/sqlite 依赖；`abiFilters` 同时打 `arm64-v8a` 与 `x86_64`，`NativeEngine` 按 `Build.SUPPORTED_ABIS` 选择对应目录。APK 可在 x86_64 模拟器/ChromeOS 上运行。
- **终端面板**：编辑器内新增命令终端，保留项目内 cwd，支持 `cd`/`pwd`、20 秒超时、6000 字符输出上限；从命令面板与编辑器工具栏均可打开。它是非交互式命令会话，不是 PTY，vim/top 等全屏程序不可用。
- **只读子 Agent**：新增 `delegate_task` 工具，把“先读多个文件再汇总”的独立探索交给隔离子上下文；子 Agent 只挂 `read_file` / `list_files` / `search_text`，不能写文件或执行命令。
- **离线语义索引**：新增 `semantic_search` 工具，按 TF-IDF + 余弦相似度对项目分块检索，返回路径、行号与相关度；不下载 embedding 模型，完全离线。

### 修复

- **x86_64 自检误报**：`EnvDiagnostics` 与 `EngineProvider` 的架构门槛原本硬编码 arm64-v8a，x86_64 会被拒绝；改为识别 `arm64-v8a` / `x86_64` 两种原生 ABI。
- **标准库解压校验死锁**：`stdlibOk()` 要求 `.unpacked_ok` 标记，但标记只在校验通过后创建，形成“永远校验失败”的循环。拆成 `hasStdlibFiles()` 与 `stdlibOk()`，校验通过后再落标记。
- **x86_64 C 扩展名硬编码**：`ensureExtensions()` 只查 `math.cpython-313-aarch64-linux-android.so`；按 ABI 生成 `aarch64-linux-android` / `x86_64-linux-android` 后缀。

### 构建

- `versionCode 26` / `versionName 0.0.26`。
- 双 ABI release APK 约 31MB，SHA-256 `b11c30d917039e0083bc2f074524d9d1b7f7e06e929cccbb1203bb2f318b1de0`；debug APK 约 49MB，SHA-256 `e6921861db0e73f1f81822208624f48332aa0a1aa9a2b7a92148d52521f699f0`。
- 签名证书 SHA-256 `1b02135746d1426d7beda47e706fdb2c77a7145ea41e0f7e14addb191b87fac5`（`CN=CodePocket`，RSA-4096）。
- 单元测试 124 个通过（含终端、语义索引、只读子 Agent）。
- x86_64 模拟器实测：安装、启动、Python `main.py` 运行退出码 0、自检 12 项全绿、终端 `pwd` 返回项目目录。

## [0.0.25] — 2026-11-23

### 新增

- **Agent 计划模式**：先输出 `Plan` 步骤并等待用户批准，再进入工具执行；Agent 面板与设置页均可开关，默认关闭以兼容小模型。
- **跨轮对话**：同一 Agent 会话保留上一轮目标与结论，新增「新会话」入口；项目规则兼容 `CLAUDE.md`、`.cursorrules`、`.windsurfrules`、`.github/copilot-instructions.md`。
- **上下文 token 预算**：`ContextBuilder` 增加粗略 token 估算、系统提示/历史消息双重裁剪，Agent 面板显示约多少 tokens；本地模型按 2048 token 预算收紧。
- **多 Provider 预设**：设置页内置 DeepSeek、硅基流动、智谱、月之暗面、本机 Ollama 的端点与模型名，密钥仍由用户填写。
- **网络重试**：AI 助手与 Agent 的 429/5xx 请求自动退避重试，支持 `Retry-After`。
- **AI 助手会话持久化**：对话落到应用私有目录，重启恢复最近 40 条，新增「新对话」。
- **MCP resources / prompts**：除 tools 外桥接资源列表、资源读取、prompt 列表与 prompt 获取。
- **终端命令工具**：Agent 可在项目根目录执行非交互式 `sh` 命令，超时/输出截断，执行前仍需审批。
- 系统提示要求改完代码调用 `run_tests`，没有测试时至少 `run_file` 验证入口。

### 构建

- `versionCode 25` / `versionName 0.0.25`。

## [0.0.24] — 2026-11-23

### 修复

- **Python 子线程 input() 的 JNI 野指针**：`bridge_input` 在 `AttachCurrentThread` 后先 `DetachCurrentThread`，随后继续用已失效的 `JNIEnv` 调用 `GetStringUTFChars` / `DeleteLocalRef`。在 Python 自建线程里调用 `input()` 会触发 native 崩溃。0.0.24 改为先取字符串、删局部引用，最后再 Detach。
- 重新编译并剥离 `libpybridge.so` / `libpython3.13.so`，APK 内 C 扩展仍为 53 个。

### 构建

- `versionCode 24` / `versionName 0.0.24`。

## [0.0.23] — 2026-11-23

### 修复

- **C 扩展仍然缺失（0.0.22 未覆盖的真根因）**：Android PackageManager 只解压 `lib<name>.so`；`math.cpython-313-...so`、`_ssl...so` 等 Python 扩展不带 `lib` 前缀，安装后不会出现在 `nativeLibraryDir`。0.0.23 在首次启动时从 APK 的 `lib/arm64-v8a` 把 53 个 C 扩展抽到 `python-stdlib/lib/python3.13/lib-dynload`，CPython 从默认 `lib-dynload` 路径加载；`libpython3.13.so`、`libpybridge.so`、`libssl_python.so` 等仍由系统解压到 `nativeLibraryDir`。
- **首次启动自检误报**：环境准备阶段先完成标准库解压与 C 扩展抽取，再进入主界面，避免用户一进来点自检就看到“C 扩展缺失”的假红。
- **JNI 初始化阶段的野指针**：`libpybridge` 先 `ReleaseStringUTFChars(stdlibPath)`，随后又用已释放的 `sp` 拼 `lib-dynload/site-packages` 路径；在部分设备上会直接触发 native 崩溃（表现为一运行就退出）。0.0.23 把释放移到路径注入之后。
- **加密设置损坏导致启动崩溃**：`EncryptedSharedPreferences` 读取失败（Keystore key 失效 / 文件损坏）时回退默认值并标记 `encryptionFallback`，不再在 ViewModel 构造期抛异常。
- **引导返回键**：从新手引导按系统返回键也会记为已看过，避免每次启动重复弹。

### 构建

- `versionCode 23` / `versionName 0.0.23`。

## [0.0.22] — 2026-11-23

### 修复

- **原生库未解压导致运行闪退 / 自检误报**：`useLegacyPackaging=false` 时 `/lib/arm64` 下没有 `libpython3.13.so`、`libpybridge.so` 和 C 扩展，CPython 无法初始化。改为 `useLegacyPackaging=true` + `extractNativeLibs=true`，安装时把原生库解压到 `nativeLibraryDir`。
- **自检诊断更可操作**：工具链缺失时直接给出「重新检测 / 查看使用指南 / 重装最新 APK」路径，不再只罗列缺失文件。

### 新增

- **首次启动新手引导**：说明 CodePocket 是什么、三步开始、界面入口、运行闪退排查。
- **指南入口**：抽屉「指南」、命令面板「使用指南」、自检失败页均可再次打开。

### 构建

- `versionCode 22` / `versionName 0.0.22`。

## [0.0.21] — 2026-11-23

### 新增

- **MCP 工具**：Streamable HTTP / SSE data 响应；initialize → tools/list → tools/call，
  只读工具自动执行，带副作用工具仍走审批。
- **命令面板自定义命令**：`.codepocket/commands` 下的 Markdown 直接填入 Agent。
- **项目 JS 插件**：`.codepocket/plugins` 下的 `run(input)` 在 Rhino 沙箱执行，
  禁止 Java/文件/网络访问，默认关闭。
- **下载前台服务**：复用现有 ExecutionService，按 tag 引用计数，退后台不被杀。
- **Qwen3.5-2B 本地模型**：ModelCatalog 增加 Qwen3.5-2B Q4_K_M（约 1.28GB，ModelScope 国内源），作为 MiniCPM5 之外的 2B 级备选。

### 构建

- `versionCode 21` / `versionName 0.0.21`。

## [0.0.20] — 2026-11-23

### 新增

- **Agent 历史会话**：Agent 面板新增「历史会话」入口，列出最近 20 个会话的任务、
  时间、事件数与完成状态；可回放完整工具轨迹，也可单独删除。会话文件保留最近 30 个。
- **完整 .part 恢复**：进程在“下载完成、改名之前”被杀后，下次启动直接校验完整 `.part`，
  不再用 Range 请求撞 HTTP 416。
- **下载取消真生效**：每个读写循环检查协程取消，暂停不再等到整段下载结束；
  下载中禁止删除，避免 `.part` 与删除竞态。
- **本地模型校验态**：下载完成后单独显示「校验中…」，不再显示 100% 卡住。
- **NOTICE**：补充 llama.cpp（MIT）与 MiniCPM5 模型权重（Apache-2.0）声明。

### 修复

- 下载空间检查在 `usableSpace=0` 时不再绕过。
- 历史会话打开时清空上一会话的检查点，避免撤销按钮指向错误快照。
- Agent 事件 JSONL 落盘移到 IO 线程，避免主线程写文件。
- 会话 ID 改用 UUID 后缀，避免同一毫秒内碰撞。
- 会话只在工作区/Provider 校验通过后创建，避免留下空会话。

### 构建

- `versionCode 20` / `versionName 0.0.20`。

## [1.0.1] — 2026-09-27

### 修复

- **引擎：`__file__` 等模块属性注入**。`PyRun_FileExFlags` 不会像标准运行那样自动设置
  `__file__/__cached__/__loader__/__spec__`，用户脚本里 `os.path.dirname(__file__)` /
  `Path(__file__)` 等高频写法会直接 `NameError`（已实测复现）。已在 `pybridge.c` 注入，
  并重编 `libpybridge.so`（NDK 27.3 + CPython 3.13.9 交叉头文件）。
- **引擎：并发运行状态机加固**。`execFile` 是阻塞 JNI 调用，协程 cancel 无法中断；
  原实现提前复位 busy 导致旧脚本未退出时新运行并发执行（sys.path/cwd/argv 互相污染、
  输出串台）。现 busy/running 只在 execFile 真正返回时复位；Finished 事件幂等去重；
  `stop()` 增加中断兜底线程（2s 未收尾补发 Finished 130）。
- **UI：`stopRun` 兜底由 3s 延长到 8s** 并对齐引擎实际状态，避免"UI 已停、进程还在跑"。
- **UI：运行 .java 文件给出明确提示**（原实现把 Java 源码当 Python 执行，报无意义语法错误）。
- **构建脚本**：`pkill -9 -f GradleDaemon` 会误杀用户所有项目的 Gradle 进程，改为
  `gradlew --stop` + 只清理陈旧（>10min）锁文件。

### 变更

- **品牌化**：项目更名为 **CodePocket「口袋码」**，README 全面改版；
- **文档体系上线**：`docs/BRANDING.md`（品牌方案）、`docs/INTRODUCTION.md`（项目介绍）、
  `docs/USER_GUIDE.md`（用户手册）、`docs/ARCHITECTURE.md`（技术架构）、
  `docs/ROADMAP.md`（路线图）、`docs/PROMOTION.md`（宣传文案包）、`docs/FAQ.md`（常见问题）、
  `CONTRIBUTING.md`、`SECURITY.md` 更新；
- **README 如实修正**：移除"预装 numpy/pandas/matplotlib"等不实表述，架构描述对齐原生 CPython；
- 清理 4 处未使用 import。

## [1.0.0] — 2026-09-26

### 新增

- **正式版发布**（versionCode 14），双引擎架构收口：APK 带原生运行时用 NativeEngine，
  否则回退 Pyodide（过渡期）；UI 对引擎切换透明。
- 原生引擎核心能力稳定：真文件系统、`input()`/`print()` 桥接（中文不乱码）、
  死循环可中断、报错行点击跳转、20+ 高频错误人话翻译。

### 变更

- 版本号 1.0.0，包名 `com.devterminal`，minSdk 24 / targetSdk 35。

## [0.9.2] — 2026-09-25

### 新增（阶段 1：原生 CPython 引擎落地）

- **原生 CPython 3.13.9 运行引擎**（PEP 738 官方 Android 支持，零外部依赖）：
  - 工具链全部为免费公开物，**无需任何申请/授权**：NDK 27.3（Google 官方）+ CPython 源码（GitHub）+ BeeWare 预编译依赖；
  - `libpython3.13.so` 原生 ARM64 交叉编译产物 + `libpybridge.so`（自写 JNI 桥，约 350 行 C）随 APK 打包；
  - 标准库（7561 个纯 .py 文件）打包为 `assets/python-stdlib.zip`，首次运行解压到私有目录；
  - 引擎按需惰性初始化：首次运行前解压标准库并 `Py_Initialize`（约 0.5~2 秒），之后秒开。
- **双引擎架构**：`EngineProvider` 工厂自动选择——APK 带原生运行时用 NativeEngine，否则回退 Pyodide；UI 对引擎切换完全透明（`RunEngine` 接口）。
- **原生引擎核心能力**（相对 Pyodide/WASM 的质变）：
  - 原生 ARM64 性能，不再有 WASM 1/10~1/50 降速；
  - **真文件系统**：脚本直接读写 App 私有目录，`cwd = 项目目录`（不再是 WebView 虚拟 FS）；
  - `input()`/`print()` 在 Python 层桥接（自定义 TextIOBase），无死锁、中文不乱码；
    Kotlin 侧做行缓冲（CPython 的 print 按参数多次 write），`print("a","b")` 正确显示为一行；
  - **死循环可中断**：`Py_AddPendingCall` 在字节码检查点抛 `KeyboardInterrupt`；阻塞在 `input()` 时推 EOF 兜底，两条路径都能停下运行。

### 变更

- 版本号 0.9.2（versionCode 12）。
- **路线变更：废弃 Chaquopy 方案**（需向 Chaquo 公司邮件申请开源 license，违反本项目
  「零外部申请依赖」的硬约束），改为 CPython 官方 Android 支持自建原生运行时；
  `docs/CHAQUOPY_LICENSE_APPLICATION.md` 已删除。
- 引擎注入点：`EditorViewModel` 由直接 new `PyodideEngine` 改为 `EngineProvider.create(context)`。
- 构建脚本 `scripts/build_apk.sh`（沙箱专用：自动清 Gradle 孤儿锁 + 至多 3 次重试）、
  打包脚本 `scripts/package_native.sh`（NDK clang 编译 JNI 桥 + 打包标准库）入库。

### 说明

- 过渡期 Pyodide 仍在 APK 内（约 72MB assets）；原生引擎验证稳定后整体下线，
  APK 预计从约 115MB 降至约 48MB。
- `input()` 交互在原生引擎下需要用户在输出面板输入框输入——当前沿用 Pyodide 的输入面板，
  NativeEngine 已实现 `writeStdin`/`closeStdin` 接口，UI 无需改动。

## [0.9.1] — 2026-09-24

### 修复（阶段 0：运行引擎止血）
- **修复 `input()` 交互输入死锁**：原实现用 `while not __IQ__: time.sleep(0.05)`
  忙等等待输入，占死 JS 事件循环，导致 `evaluateJavascript` 注入的输入进不去，
  真机必卡 120 秒超时。改用 Pyodide 官方 `setStdin`（浏览器默认行为即
  `window.prompt`）：Android WebView 的 JS 运行在独立线程，同步弹框不卡 UI，
  交互输入真正可用。预喂输入队列保留（`run` 参数 / `pushInput` 均入队）。
- **修复死循环超时/停止在真机失效**：中断依赖 `SharedArrayBuffer`，而 WebView
  拿不到 COOP/COEP 头，SAB 恒不可用、`interruptBuffer` 恒为 null（原注释说的
  「强制重载」降级实际未实现）。现在 JS 侧把能力标记（sab/nosab）上报 Kotlin：
  无 SAB 时停止/超时走 **销毁 WebView 重建强杀**（`hardKillAndFinish`），
  死循环必然终止；Kotlin 侧兜底看门狗缩短到超时 +5s 并触发强杀。
- **修复「停止」按钮与真实运行状态脱节**：`stopRun()` 不再立即把 UI 置为已停止，
  运行状态以引擎 `Finished` 事件为唯一权威来源，真正收尾后才翻回可运行态；
  点击后先显示「正在停止…」反馈。
- **输出改为官方 write handler**：stdout/stderr 由逐字节 raw 回调改为整块
  write 回调，大幅减少 JS↔Kotlin 桥调用次数（官方文档明确 raw 不推荐）。

### 变更
- 版本号 0.9.1（versionCode 11）。运行时仍为 Pyodide 0.26.4；
  本阶段为阶段 1（迁移原生 CPython，PEP 738）前的止血修复。

## [0.9.0] — 2026-09-24

### 新增
- **三态主题（跟随系统）**：设置页「主题外观」由原来的深浅二选一升级为
  跟随系统 / 浅色 / 深色三态。选择「跟随系统」后，App 深浅随手机系统夜间模式
  自动切换，无需重启即生效；编辑器主题（跟随明暗）、Markdown/HTML 预览配色
  同步联动。旧版「深色主题」开关自动迁移为对应模式，老用户设置不丢失。

### 变更
- 版本号 0.9.0（versionCode 10）。`AppSettings.darkTheme`（Boolean）升级为
  `themeMode`（system / light / dark），SharedPreferences 增加 `theme_mode` 键，
  首次升级时按旧 `dark_theme` 值迁移（true→dark、false→light）。

## [0.8.0] — 2026-09-22

### 新增
- **matplotlib 离线画图**：3.5.2 及全部依赖（pillow / fonttools / kiwisolver / cycler /
  packaging / pyparsing / matplotlib-pyodide）随 APK 打包，约 24MB，
  sha256 与 Pyodide 0.26.4 lock 完全一致；`import matplotlib.pyplot` 即用，零网络。
  > 端到端验证：无头 Chromium 实测 `savefig` 输出合法 PNG（19143 字节，魔数 89504e47）。
- **编辑器多主题**：新增 Monokai / 明日蓝 / Solarized 暗 / Solarized 亮 四套
  TextMate 配色（源自 VS Code 内置主题，MIT），加上原有 Darcula / Quiet Light 共 6 套；
  设置页新增「编辑器主题」选择，「跟随明暗」为默认值，与旧版行为向后兼容。
  全部主题一次性预载入注册表，切换零 IO 等待。
- **Markdown / HTML 实时预览**：打开 .md / .html 文件后，顶栏或命令面板可开启
  编辑器分屏预览（上编辑 / 下渲染）；基于 org.jetbrains:markdown 0.7.3
  （IntelliJ 同款解析器，GFM 方言支持表格/删除线/任务列表）。
  编辑停止 350ms 后自动刷新（collectLatest 防抖，只渲染最后一次输入）；
  预览 WebView 禁用 JavaScript 与 file:// 访问；超 500K 字符的文件分段渲染保护。

### 测试
- 新增 `MarkdownRendererTest`（6 例）：标题/加粗、GFM 表格、代码块转义、
  页面壳明暗背景、HTML 直通、畸形输入兜底。全部 29 例通过。

### 变更
- 版本号 0.8.0（versionCode 9）；切到不可预览文件时预览分屏自动收起。

## [0.7.0] — 2026-09-22

### 新增
- **数据科学栈离线内置**：随 APK 打包 numpy 1.26.4 / pandas 2.2.0 官方 Pyodide wheel
  （含 python-dateutil / pytz / six，共约 37MB，sha256 与 lock 完全一致）。
  运行器在执行用户代码前用 `loadPackagesFromImports` 按 import 自动装载——
  写 `import pandas` 即用，全程零网络；看门狗在装载完成后才启动，不侵占用户超时。
  > 端到端验证：无头 Chromium（与 Android WebView 同内核）实测本地装载 0.7s，
  > DataFrame 统计与 numpy 线性代数结果正确。
- **Git 能力回归（JGit）**：引入 `org.eclipse.jgit`（纯 Java，EDL-1.0），
  重写 `GitManager`：init（main 分支）/ status（分支、变更、ahead/behind、最近提交）/
  commitAll / push / pull 全部在应用进程内完成，依旧离线；远程 URL 支持内嵌 token，
  结果回显只显示主机名，**不回显 token**。UI 层零改动。
- 环境自检补齐「数据科学库」「Git 操作」两项能力标注。

### 修复
- **AI「已配置」判定恒为真**：`aiConfigured` 原为「端点非空」，而默认值是占位的
  本机 Ollama 地址（恒非空），导致「未配置」引导永不出现、AI 动作直接发请求必败。
  改为显式持久化标志（`KEY_AI_CONFIGURED`），仅在设置页点「保存 AI 配置」时置真；
  未配置时 AI 面板禁用输入与「发送」，占位文案给出引导。
- 关于页过时文案：删除「内置 Python / Java 工具链」「Termux packages」，
  改为 Pyodide / CPython 实况，许可列表同步更新。

### 变更
- 版本号 0.7.0（versionCode 8）；APK 体积约 32MB → 约 44MB
  （37MB wheel 在 APK 内压缩后约 11MB 增量 + JGit 约 1MB）。

### 测试
- 新增 `GitManagerTest`（6 例，纯 JVM）：真实建仓 / 提交 / 状态读取；
  顺带修出真 bug——刚 init 未提交时 `log()` 抛 NoHeadException 导致 status 误报
  「不是仓库」。全部 23 例通过。

## [0.6.0] — 2026-09-22

### 重构（核心：把「离线」从宣传变成事实）
- **执行引擎整体替换为 Pyodide（WebAssembly）**：新增 `PyodideEngine.kt`，
  以内嵌 WebView + `WebViewAssetLoader` 承载 WASM 版 CPython，
  运行时（`pyodide.asm.wasm` + `python_stdlib.zip`，约 13MB）随 APK 打包，**装完即离线**。
- **删除旧的原生工具链方案**：移除 `TermuxEngine.kt` 与 `EnvironmentInstaller` 中
  的 `usrtar.zip` 解压逻辑、Termux 环境变量模拟等全部死代码。
  > 旧方案要求一个 441MB 的 `assets/usrtar.zip`，该文件不入库、必须联网下载，
  > 导致 clone 源码构建出的 APK 根本跑不了代码——「离线」名不副实。
- **新增运行器页面** `app/src/main/assets/python-runner.html`：
  移植自 `design/pyworker.js` 的成熟逻辑（流式 UTF-8 解码、traceback 内部帧清洗、
  setup 与用户代码分离以避免行号偏移、中断缓冲超时）。

### 新增
- **`input()` 运行中交互**：JS 侧输入队列 + `pushInput` 桥，程序阻塞在 `input()` 时
  可被 Kotlin 侧实时唤醒，不再是"仅支持预喂"。
- **环境自检改为校验运行时完整性**：`EnvDiagnostics` 现在逐个检查 APK 内
  Pyodide 资源是否齐备，并明确标注各项能力（Python 可用 / Java 不可用）。
- **构建约束固化**：`build.gradle.kts` 增加 `noCompress += listOf("wasm", "zip")`，
  避免 AAPT 压缩导致 WebView 无法加载 WASM；新增 `androidx.webkit` 依赖。

### 变更（能力边界，诚实标注）
- **Java 执行下线**：JVM 无法运行于 WebAssembly 沙箱。保留编辑与语法高亮，
  运行时给出明确说明而非报错崩溃。
- **Git 操作下线**：原依赖工具链内的 git 二进制。保留 UI 与接口，
  后续可通过 JGit（纯 Java 实现）恢复。
- README 全面校正：删除"Python + Java 全程零网络""本机 Ollama 离线 AI"
  等与实现不符的宣称，新增「能力边界」章节。

### 说明
- Java 与 Git 的恢复属于后续独立阶段的工作，本轮聚焦「让 Python 真正离线可跑」。

## [0.5.0] — 2026-09-17

### 新增
- **离线真实 Python 运行引擎（设计稿验证版）**：`design/mockup.html` 接入 Pyodide 0.26.4
  （本地 vendor 到 `design/pyodide/full/`，Web Worker 架构），实现真实 stdout/stderr 捕获、
  完整 traceback、`input()` 预喂、多文件 `import`、超时中断。
- **内置题库（11 道真实可运行题目）**：素数筛 / 递归栈溢出 / 语法错误 / 除零 / KeyError /
  多文件模块导入 / 5000 行长输出 / 死循环超时 / 文件读写 / 中文 Emoji / 交互式问答。
- **报错行点击跳转**：真实 traceback 进入输出面板即自动变为可点击行，点击后编辑器滚动并高亮
  对应源码行；与 Kotlin 端 `parseErrorLine`（`app/.../OutputPanel.kt`）正则逐字符一致。
- **端到端测试脚手架**：`tools/serve_design.py`（多线程静态服务）、`tools/test_suite.py`
  （Playwright 驱动逐题真实运行 + 断言 + 截图 + 录屏）、`tools/test_ui.py`（UI 交互覆盖）、
  `tools/build_promo.py`（宣传片生成）。

### 修复
- **Pyodide worker 超时提示字符串拼接错误**：原 `'⏱ 已超时取消（" + sec + 's）…'` 拼接语法错误，
  `sec` 不被插值；改为正确拼接。
- **traceback 内部帧清洗**：过滤 Pyodide 注入的 `_pyodide/_base.py`、`CodeRunner` 等栈帧，
  避免被 `parseErrorLine` 误判为可跳转行。
- **中文/Emoji 乱码**：`raw` 回调返回 UTF-8 字节流，改用 `TextDecoder('utf-8')` 流式解码。
- **多文件 import 失败**：`runPythonAsync` 不自动把 cwd 加入 `sys.path`，setup 阶段补 `sys.path.insert`。
- **报错行号偏移**：setup 与用户代码分离为两次 `runPythonAsync`，避免 setup 撑偏行号。

### 测试
- 端到端全量测试 **11/11 通过**（约 44s，含首次解释器预热）；
  逐题验证真实输出、报错行可跳转、中文无乱码、死循环 3s 安全终止。
- 交付：宣传片 + 题库遍历录屏 + UI 交互录屏 + 27 张截图 + 结构化测试报告（见 `test_results/`）。

### 构建
- versionCode 5 → 6，versionName 0.4.1 → 0.5.0。
- 说明：本轮核心改动落在 `design/` 设计稿与测试工具链，**原生 APK 未集成 Pyodide**
  （APK 仍走 `usrtar.zip` + `TermuxEngine` 的本地 Linux 用户空间方案）。

## [0.4.1] — 2026-09-16

### 新增
- **横屏两栏布局**：编辑器在左（64%）、输出面板在右（36%），中间细分隔线；
  内容抽成局部 Composable 复用，拖拽把手仅在竖屏显示。
  设计稿的 grid 方案（design/mockup.html）先行验证过收益：横屏下代码可见高度从 0 恢复到 180dp
- **JUnit 单元测试**：`ParseErrorLineTest` 17 个用例锁定报错行解析
  （Python traceback / javac / flake8 / 路径前缀 / 版本号与时间戳误报 / Int 溢出等），
  与 `tools/tests/test_parse_error_line.py` 用例一一对应，跑 `./gradlew :app:testDebugUnitTest`

### 构建
- versionCode 4 → 5（0.4.0 的 APK 无横屏两栏，避免同版本号两种内容）
- 排查：多个 Gradle daemon 并存时会复发 usrtar.zip 的 MD5 哈希竞态
  （本次发生在 `packageDebug`），`./gradlew --stop` 后单实例构建即恢复稳定

## [0.4.0] — 2026-09-16

### 构建（技术栈全面升级）
- **Kotlin 2.0.21（K2 编译器）**：Compose 编译器改为独立插件 `org.jetbrains.kotlin.plugin.compose`，
  移除 `kotlinCompilerExtensionVersion`
- **AGP 8.7.3 / Gradle 8.11.1 / compileSdk & targetSdk 35**（Android 15）
- **Compose BOM 2024.12.01**（material3 1.3.1）、SoraEditor 0.23.6、
  core-ktx 1.15.0 / activity-compose 1.9.3 / lifecycle 2.8.7、desugar 2.1.4
- **Version Catalog**（`gradle/libs.versions.toml`）：全部依赖版本集中管理
- `org.gradle.parallel=false`：规避 Gradle 8.11 并行执行对 461MB usrtar.zip 的哈希读取竞态

### 新增（使用逻辑）
- **报错行可点击跳转**：输出面板解析 `line N` 与 `file.ext:N` 两类报错行（0 基换算、
  跳过 💡 提示与 —— 分隔线），点击后编辑器光标直达对应行；
  `ScrollToLineRequest` 用 seq 自增保证连点同一行也响应
- **首启引导空态**：无项目时展示「写代码，不用联网」+ 新建 / 导入双入口；
  有项目未开文件时改为「选一个文件开始」
- **弹窗状态收敛为 `Overlay` 密封接口**：替换 9 个独立布尔值，
  编译期保证同一时刻至多一个面板
- **返回键三层处理**：搜索面板 → 抽屉 → 弹窗，逐层退出

### 变更（前端）
- **Motion 动效体系**（`theme/Motion.kt`）：统一时长（120/220/320ms）与缓动曲线
  （Emphasized Decelerate / Accelerate），拖动跟随用 NoBouncy spring
- **触觉反馈**（`components/Haptics.kt`）：运行结束按退出码区分成功（CONFIRM，
  API<30 回退 VIRTUAL_KEY）/ 失败（LONG_PRESS）
- **触控尺寸**：图标按钮最小 48dp，符号栏键帽 32→38dp
- 输出面板高度上限改为按可用高度 62% 动态计算（横屏 / 小屏不再挤没编辑器）

### 文件管理
- 文件树默认展开第一层，折叠目录显示子项数量
- 抽屉标题栏提示「长按可重命名」

### 设计
- `design/mockup.html` 与 App 行为对齐：首启引导可视化、报错行点击跳转演示
  （utils.py 第二次运行）、浅色主题（色值逐项对齐 `Theme.kt` 的 QuietLight）
- 修复设计稿 4 处缺陷：跳转重建 DOM 冲掉语法高亮、行号高亮残留、
  引导页盖住状态栏、行内高度压过媒体查询
- 补齐响应式媒体查询：矮屏压缩输出面板、横屏两栏网格
- 新增 21 张高清截图（深色 15 + 浅色 6）、33.6s 交互录屏 `design/demo.mp4`

## [0.3.0] — 2026-09-14

### 新增
- **命令面板 ⌘K**：顶栏命令图标唤出，搜索直达所有功能（运行 / Git / AI / 片段 / 设置），Cursor 范式
- **Git 面板**：状态 / 初始化 / 提交 / 推送 / 拉取，直接调用内置 git 二进制（离线可用）；
  报错翻译（403→令牌、rejected→先拉取）；Git 身份与远程 URL 配置
- **AI 助手（可选）**：OpenAI 兼容协议，默认端点本机 Ollama（本地推理 = 离线可用）；
  快捷动作：解释此文件 / 修复运行错误 / 生成测试 / 加注释；
  「修复运行错误」自动携带最近运行的报错输出与当前文件上下文
- **全局搜索**：跨文件搜索（防抖 400ms、上限 200 条），命中行点击直达
- **代码片段库**：12 个骨架模板（Python 主入口 / 类 / dataclass / 装饰器，
  Java POJO / Stream / 正则等），从命令面板插入光标处
- **双指缩放**：编辑器字号随捏合手势调整（10–24sp，实时持久化）
- **输出分享**：系统 ShareSheet 分享运行结果
- 设置页新增 AI 端点配置（URL / 模型 / Key）

### 变更
- Manifest 增加 `INTERNET` 权限：仅 AI 可选用途，未配置端点时 App 不发起任何网络请求

## [0.2.0] — 2026-09-14

### 新增
- **多文件 Tab 条**：一键切换，关闭自动切相邻（对标 VS Code / Acode）
- **快捷符号栏**：26 编程符号 + Tab / 退格，插入走编辑器撤销栈（对标 Pydroid 3 / Spck）
- **查找 / 替换**：实时匹配计数、跳转滚动定位、单个 / 全部替换
- **会话恢复**：重启回到上次项目 / Tab 列表 / 编辑文件
- **输出面板拖拽调高**（120–560dp），高度持久化
- **底部状态栏**：Ln/Col、语言、字符数、保存状态

### 构建（v0.3.0 实测产出 APK）
- **真实构建成功**：纯 Linux 沙盒（无 Android SDK、无 Google 网络）内 `assembleDebug` 出包，
  产物 47MB debug APK（com.devterminal 0.3.0 / minSdk 24 / targetSdk 34）
- **内置离线工具链 usrtar.zip**：从 Termux F-Droid 官方 bootstrap（arm64 v1022，sha256 校验）
  + termux-main 仓库 BFS 解析 17 个依赖包合并而成；Python 3.14.6、bash、coreutils、curl、
  tar、sqlite 等共 1745 个文件，symlink 全部物化、ELF 依赖静态校验通过
- **内置语法高亮资源 textmate/**：18 种语言（py/java/kt/js/ts/html/css/json/md/sh/c/cpp/go/
  rs/sql/yaml/xml/lua）29 个扩展名条目，含 darcula 主题
- 开启 core library desugaring（language-textmate 0.23.5 要求）
- 构建镜像化：Gradle 8.9 → 腾讯云；Maven 依赖 → 阿里云；SDK 组件 → 腾讯云 AndroidSDK 镜像

### 修复
- 输出面板由固定 260dp 改为可调，长输出不再挤压

## [0.1.0] — 2026-09-14

### 首个版本
- Kotlin + Jetpack Compose + Material 3 完整工程
- 离线执行引擎：ProcessBuilder + termux 环境变量模拟，工具链预打包零网络
- Python 交互式 stdin（`input()`）、Java 多文件编译运行
- 环境自检、友好报错（20+ 高频错误翻译）、运行配置、文件管理、前台服务保活
- SAF 导入导出、设置页、静态补全、崩溃日志
- 高保真可交互 UI 原型（design/mockup.html）与静态自检脚本
