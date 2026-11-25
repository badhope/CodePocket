# CodePocket 技术架构

> 面向开发者：引擎、JNI 桥、线程模型、状态机与目录结构。

---

## 1. 总体架构

```
┌───────────────────────────────────────────────┐
│  Compose UI 层                                 │
│  EditorScreen · EditorViewModel · OutputPanel  │
└──────────────────┬────────────────────────────┘
                   │ RunEngine 接口（Flow<RunEvent>）
┌──────────────────▼────────────────────────────┐
│  NativeEngine（Kotlin）                        │
│  状态机：busy/running/execActive/finishedSent  │
│  sink：C 回调线程 → Flow 的事件出口             │
└──────────────────┬────────────────────────────┘
                   │ JNI
┌──────────────────▼────────────────────────────┐
│  pybridge.c（JNI 桥）                          │
│  Py_Initialize · PyRun_FileExFlags · GIL 管理  │
│  stdin/stdout/stderr 桥接 · Py_AddPendingCall  │
│  ptybridge.c（forkpty 真终端，独立 .so）        │
└──────────────────┬────────────────────────────┘
                   │ dlopen + sys.path
┌──────────────────▼────────────────────────────┐
│  libpython3.13.so（arm64 / x86_64）· C 扩展 · 标准库 zip │
└───────────────────────────────────────────────┘
```

---

## 2. 引擎模块（`app/src/main/java/com/devterminal/engine/`）

| 文件 | 职责 |
|---|---|
| `RunModels.kt` | `RunRequest` / `RunEvent` 等运行契约（语言用 `languageId`） |
| `RunEngine.kt` | 引擎接口：`run` / `stop` / `writeStdin` / `closeStdin` / `release` |
| `LanguageRegistry.kt` | 单一事实源：20 种语言的 id/扩展名/语法/补全/运行级；3 运行 + 17 编辑 |
| `RuntimeRegistry.kt` | languageId → RunEngine 路由：Python / JavaScript / Lua |
| `EngineProvider.kt` | 工厂：Python 运行时自检 → 创建 `NativeEngine` |
| `NativeEngine.kt` | Python 原生引擎：初始化、执行、中断、状态机 |
| `JavaScriptEngine.kt` | Rhino 运行时：ES6、console/input、超时中断 |
| `LuaEngine.kt` | LuaJ 运行时：Lua 5.2、print/input、DebugLib 超时 |
| `NativeBridge.kt` | JNI 声明：`initialize` / `execFile` / `pushInputLine` / `pushEof` / `requestInterrupt` / `shutdown` |
| `PdbRunner.kt` | pdb 包装器：compile 目标源码 → `pdb.run`，目标路径走 argv[1] |
| `PtyBridge.kt` | 真 PTY 前端：`nativeStart` / `nativeWrite` / `nativeResize` / `nativeStop`，字节回调 → Kotlin |
| `PtyTerminalView.kt` | 本地 WebView + xterm.js 终端：PTY 字节按 base64 写入、键盘回传、`FitAddon` resize、亮暗主题、离线限制 |
| `EnvironmentInstaller.kt` | 环境自检与安装（引擎相关部分） |
| `ExecutionService.kt` | 前台服务：运行期间保活（Android 12+） |
| `ProcessGroup.kt` | 命令进程组：pidfile + `/system/bin/setsid` + 负 PID 信号；setsid 缺失时退化 |
| `GitManager.kt` | JGit 封装：init / commit / push / pull / clone（HTTPS） |
| `FriendlyError.kt` | Python / JavaScript / Lua 高频错误的"人话"翻译 |
| `CompletionProvider.kt` | 静态补全：按 `CompletionProfile` 的关键字 / 内置函数 / 文件符号 |

---

## 3. JNI 桥（`app/src/main/cpp/pybridge.c`）

### 初始化（`initialize`）
1. `PyImport_AppendInittab("dtbridge", ...)` 注册桥模块（必须在 `Py_Initialize` 前）；
2. `Py_Initialize()`；
3. 注入 Python 桥接代码：`_DtOut` / `_DtErr` / `_DtIn`（继承 `io.TextIOBase`）替换 `sys.stdout/stderr/stdin`，输出经 `dtbridge._output` 回调到 Kotlin，`input()` 经 `dtbridge._input` 读取；
4. 标准库路径注入 `sys.path`。

### 执行（`execFile`）
1. `os.chdir(工作目录)` + 脚本目录插入 `sys.path`（先去重，避免跨脚本串扰）；
2. 构造 `sys.argv = [脚本路径, ...args]`（用 C API，避免字符串转义）；
3. 注入 `__file__` / `__cached__` / `__loader__` / `__spec__`（对齐 CPython 标准运行环境）；
4. `PyRun_FileExFlags(fp, path, Py_file_input, ...)` 执行；
5. 错误时 `PyErr_Fetch` 取异常文本返回给 Kotlin；成功返回 `NULL`。

### 中断（`requestInterrupt`）
- `Py_AddPendingCall` 在字节码检查点抛 `KeyboardInterrupt`；
- 阻塞在 `input()` 时：`pushEof()` 让 `input()` 收到 EOFError 立即返回（顺序必须 EOF 先、中断后，否则 GIL 死锁）。

### 线程与 GIL
- `initialize` 在 IO 线程：`Py_Initialize` 后 `PyEval_SaveThread` 释放 GIL，注入代码时 `PyGILState_Ensure` 重新持有；
- `execFile` 在独立 IO 线程：`PyGILState_Ensure` / `PyGILState_Release` 成对使用；
- Python 输出线程回调 Kotlin 时 `AttachCurrentThread` → `CallVoidMethod`。

---

## 4. 运行状态机（`NativeEngine.run`）

关键约束：**execFile 是阻塞 JNI 调用，协程 cancel 无法中断它**。因此：

```
busy（AtomicBoolean）   —— 是否允许新运行
running（@Volatile）    —— 本次运行是否仍在执行
execActive（AtomicBoolean）—— C 层调用是否仍占用
finishedSent（AtomicBoolean）—— Finished 事件幂等去重
sink（AtomicReference） —— C 回调 → Flow 的事件出口
```

时序：
1. `busy.compareAndSet(false, true)` 成功才继续，否则拒绝并发运行；
2. 发出 `Started` → 设置 `sink` → 启动 `execFile` 协程 + 看门狗协程；
3. `execFile` 返回后：发 `Stderr`（如有）→ `sendFinished(0/1)`；
4. **`finally` 里才复位 `busy/running/execActive` 并清 `sink`**——保证旧脚本真正结束前不允许新运行；
5. 看门狗超时（`timeoutMs + 5s`）：推 EOF → `requestInterrupt` → 等 2s → 仍未退出则警告并 `sendFinished(130)`；
6. `stop()`：推 EOF + 中断 + 2s 兜底线程（脚本不响应时补发 `Finished(130)`）。

---

## 4.1 调试、PTY 与终端模拟（v0.0.29）

### Python pdb

- `NativeEngine` 不把目标文件直接交给 `PyRun_FileExFlags`；`debug=true` 时把 `PdbRunner.SCRIPT` 写到 `cacheDir/cp-pdb-runner.py`，执行 `pdb.run(compile(target))`；
- 目标路径通过 `argv[1]` 传入，`__name__="__main__"`、`__file__` 指向真实文件，保留 `if __name__` 与 traceback 行号；
- pdb 命令走既有 stdin 队列，输出走既有 stdout 桥；`NativeBridge.onInputLine()` 在阻塞等待输入前 `flushBuffers()`，否则 `(Pdb) ` 这种无换行提示会卡在缓冲区；
- 没有独立调试协议/图形变量树；`EditorViewModel.sendDebugCommand()` 只是往 stdin 写 pdb 命令。

### 真 PTY

- `PtyBridge.kt` 加载独立的 `libptybridge.so`，调用 `forkpty()` 起 `/system/bin/sh -i`；
- 原生读线程把 master fd 的字节通过 `onBytes([B)V` 回传；退出时 `waitpid` 后 `onExit(I)V`；
- Kotlin 侧不做解码/切行/剥离转义：原始 `ByteArray` 进 `EditorViewModel.ptyRaw`（`MutableSharedFlow`，replay 64，供 WebView ready 前补发启动 banner 与首个提示符）；
- `PtyTerminalView` 是本地 WebView，加载 `assets/terminal/index.html` 与 xterm.js 5.5.0；Kotlin → JS 用 base64 字节 + `term.write(Uint8Array)`，JS → Kotlin 用 `@JavascriptInterface` 回传 `onData` / `onResize` / `onReady`；
- xterm `FitAddon` 按容器算行列，`onResize` 调 `PtyBridge.resize(cols, rows)`，原生 `ioctl(TIOCSWINSZ)` 同步 shell；
- `nativeStop()` 关闭 master + SIGHUP/SIGTERM，读线程自然退出并回收 child；同一时间只允许一个 PTY；
- 终端页强制 `blockNetworkLoads`、拦截外部跳转，只加载 APK 内资源；亮暗主题由 `dark` query + `termSetTheme()` 切换。

## 4.2 移动端布局、IME 与遮挡治理（v0.0.30）

- `MainActivity` 用 `enableEdgeToEdge()` 后，根 `Surface` 统一加 `safeDrawingPadding()`；状态栏/导航栏/IME 只在这里消费一次，避免子层重复加 padding。
- `Scaffold.bottomBar` 承载底部 `StatusBar`，Snackbar 自动排到它上方，不再覆盖行号/保存状态；顶栏标题与状态栏文字都限制单行省略。
- `EdgeToEdgeDialog`：`DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)` + `safeDrawingPadding()`；卡片宽度手机上占满左右 16dp、平板 `widthIn(max = 560.dp)`，高度上限是 `BoxWithConstraints.maxHeight`。
- `QuietDialog` 的标题、footer（AI/Agent 输入框）和按钮固定，只有正文 `verticalScroll`；这样软键盘弹起后，输入框和确认按钮仍在键盘上方。
- `TerminalDialog` 改成全屏 `EdgeToEdgeDialog`：活跃内容用 `weight(1f)` 吃掉剩余高度；PTY 按键条、非 PTY 输入框固定底部。WebView 尺寸变化由 xterm `FitAddon` 的 `ResizeObserver` 重新计算 `TIOCSWINSZ`。
- 横竖屏用 `LocalConfiguration.orientation` 判断，而不是 `maxWidth > maxHeight`：IME 弹起会改变内容区高度，后者会把竖屏误判成横屏并触发左右分栏。
- 输出面板的持久偏好（`preferredHeight`）与当前渲染高度（`visibleHeight`）分离：`LayoutMetrics.visibleOutputHeight()` 按 `availableHeight - 120dp 编辑器 - 14dp 把手` 临时夹取；键盘/横屏变化不写回 `SettingsStore`。
- `CodeEditorView` 监听 `WindowInsetsCompat.Type.ime()`，在键盘弹起/切换输入法后再次 `ensureSelectionVisible()`，避免 SoraEditor 的光标被推出可视区。

## 4.3 数据安全、文件生命周期与后台执行（v0.0.31 / v0.0.33）

- **未保存修改不再静默丢弃**：`UiState.pendingNavigation` 记录待执行的 OpenFile / CloseTab / OpenProject；只有用户在 `UnsavedChangesDialog` 选择「保存并继续」或「不保存直接继续」后才继续。`autoSave=true` 仍走原自动保存路径。
- **原子写**：`ProjectManager.write`、`LocalWorkspace.writeBytes`、`CheckpointStore.writeAtomic` 均为「同目录临时文件 → `fd.sync()` → `rename`」；`ProjectManager.read` 在 5MB / 二进制探测前拦截。
- **PTY 输入 FIFO（v0.0.33 有界）**：`EditorViewModel` 用 `Channel<String>(256)` + 单消费者协程串行写 `PtyBridge.write`；`xterm onData` 不再为每个按键 `launch`，避免快速输入乱序；单次写入超过 64KB 截断并提示。终端关闭/退出时关闭队列并取消 writer。
- **Agent 覆盖护栏**：`reloadAfterAgent` 发现当前文件 `dirty` 时只提示不写 `editorText`；`restoreAgentCheckpoint` 直接拒绝；检查点 `snapshot` 单文件 8MB，`gc()` 保留最近 20 份并删除无引用 blob。
- **会话日志上限**：`AgentSessionStore` 单会话 16MB、回放 2000 条、总量 128MB；`prune()` 在 `create()` 时执行。
- **前台执行**：`ExecutionService` 同进程弱引用直接 `stopTag`，避免 Android O+ 后台 `startService` 限制；启动时持有 `PARTIAL_WAKE_LOCK`，最后一个 tag 停止时释放。
- **输出边界**：共享/剪贴板 200KB、单行 4000 字符；`AiClient` 非流式响应 2MB 字符。
- **手势与系统栏**：`CodeEditorView` 的捏合只在两指及以上消费事件；`MainActivity` 按 `themeMode.resolvesDark()` 同步状态栏/导航栏图标明暗。
- **销毁收尾（v0.0.33）**：`EditorViewModel.onCleared()` 取消 AI/Agent/下载/光标 Job，停止 PTY，释放 NativeEngine 与 RuntimeRegistry；`AgentSessionStore.metaOf` 单遍流式读 JSONL；PTY 输入队列 256 容量、单次 64KB 上限。

## 4.4 项目迁移与进程收尾（v0.0.34）

- **项目 zip**：`ProjectArchive.export` 用 `walkTopDown` 流式写 zip，跳过 `.git`、`build`、`dist`、`node_modules`、`__pycache__`、`.gradle`、`.idea` 和符号链接，上限 256MB；`import` 先解压到 `projectsRoot/.import-<UUID>`，逐条校验 canonical path，拒绝绝对路径、`..`、盘符与空路径，限制 10,000 条 / 单文件 48MB / 总解压 256MB，成功后 rename 到项目目录；单顶层目录自动提升，重名自动 `-1`/`-2`。
- **Git clone**：`GitManager.cloneInto` 只接受不存在或空的目标目录；`https://user:token@host/repo.git` 中的凭据拆到 `UsernamePasswordCredentialsProvider`，克隆 URL 不含 token，避免写入 `.git/config`；失败删除半成品目录。
- **forkpty 子进程**：`ptybridge.c` 在 fork 前构造 `argv` 与 `envp`（过滤旧 `TERM`/`PS1`，追加 `TERM=xterm-256color`、`PS1=\w $ `），子进程只做 `chdir` + `execve`，不再在 `pid==0` 分支调用 `setenv`/`malloc` 系函数。
- **命令进程组**：`ProcessGroup` 用 `sh -c 'echo $$ > pidfile; shift; exec /system/bin/setsid "$@"'` 把 shell 放进新会话，Kotlin 对负 PID 发 `SIGTERM`，300ms 后 `SIGKILL`；`/system/bin/setsid` 不存在时退回 `exec "$@"`，行为与旧版一致。`RunCommandTool` 与 `TerminalSession` 已接入。
- **引擎卡死兜底**：`NativeEngine.isBusy` 暴露 `busy`；`stopRun()` 8 秒后仍占用则 UI 置 `engineStuck`，输出面板显示「重启应用」；`restartApp()` 同步保存当前文件，用 `AlarmManager` 约 900ms 后重新拉起入口，再 `killProcess`。**这不是解释器进程隔离**：卡在不可中断 C 调用时 `busy` 仍不会复位，只能重启应用。

---

## 5. 标准库与 C 扩展的打包

- **纯 Python 标准库**：`assets/python-stdlib.zip`（约 12.5MB 未压缩内容 / 4.32MB 打包体积，`noCompress` 保证 AAPT 不压缩；已剔除 test/idlelib/turtledemo），首次运行解压到 `files/python-stdlib`，校验标记 `.unpacked_ok`；
- **C 扩展**：`jniLibs/arm64-v8a/` 与 `jniLibs/x86_64/` 下的 `*.so`（math、_json、_socket、_ssl、_sqlite3、_ctypes 等），APK 安装后落在 `nativeLibraryDir`，`initialize` 时插入 `sys.path`；
- **依赖库**：`libssl_python.so` / `libcrypto_python.so` / `libsqlite3_python.so` 一并打包；
- 重新打包/重编脚本：`scripts/package_native.sh`（需 NDK 27.3 + CPython 3.13 交叉编译环境）。

---

## 6. 目录结构

```
app/src/main/
├── AndroidManifest.xml
├── assets/            # python-stdlib.zip、textmate 语法、模板、terminal/（xterm.js）
├── cpp/pybridge.c     # Python JNI 桥
├── cpp/ptybridge.c    # 真 PTY JNI 桥（独立 libptybridge.so）
├── java/com/devterminal/
│   ├── MainActivity.kt
│   ├── engine/        # 运行引擎全家桶
│   ├── project/       # ProjectManager、ProjectArchive、Templates、GitManager
│   ├── settings/      # SettingsStore（加密偏好）
│   └── ui/            # Compose 界面（EditorScreen 等）
└── jniLibs/<abi>/     # libpython3.13.so、libpybridge.so、libptybridge.so、C 扩展
scripts/               # build_apk.sh、package_native.sh
tools/                 # selfcheck.py、test_suite.py（Web 原型测试）
```

---

## 7. 构建与工具链

| 组件 | 版本/来源 |
|---|---|
| JDK | 17+ |
| Android SDK | platforms;android-35、build-tools;34.0.0 |
| Gradle | 8.11.1（wrapper 随仓库） |
| AGP / Kotlin | 8.7.3 / 2.0.21 |
| CPython | 3.13.9（官方 PEP 738 Android 支持） |
| NDK | 27.3.13750724 |
| 编辑器 | SoraEditor 0.23.6（LGPL-2.1，动态链接） |
| Git | JGit 6.10.1（纯 Java） |

依赖镜像：阿里云 Maven 优先，Google 备选；Gradle 发行包走腾讯云镜像。
