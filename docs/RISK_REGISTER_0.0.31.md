# CodePocket 0.0.31 高影响问题清单

生成时间：2026-11-25  
范围：0.0.30 发布后对 `EditorViewModel`、`ProjectManager`、`LocalWorkspace`、`CheckpointStore`、`AgentSessionStore`、`ExecutionService`、`PtyBridge`/`ptybridge.c`、`NativeEngine`、`EditorScreen`、`CodeEditorView` 的逐项审计。  
原则：只列会造成**数据丢失、文件损坏、进程/电量泄漏、OOM/ANR、发布事故或明显交互失效**的问题；不把风格偏好当 bug。

说明：本文保留 0.0.31 时点的原始记录；0.0.33/0.0.34 的处理结果见文末「五、后续版本处理结果」。

## 一、本轮已修复（0.0.31）

### P0 数据安全 / 文件损坏

1. **关闭自动保存后切换文件会静默丢改动**
   - 旧行为：`autoSave=false` 时 `openFile` 直接读新文件，当前脏文本被覆盖，`dirty` 被清掉，没有提示。
   - 处理：新增 `PendingNavigation` + “有未保存的修改”对话框，提供「保存并继续 / 不保存直接继续 / 取消」；切文件、关 Tab、切项目都走同一条路径。
   - 位置：`EditorViewModel.openFile/closeTab/openProject/resolvePendingNavigation`，`EditorDialogs.UnsavedChangesDialog`。

2. **保存不是原子写，崩溃/断电可能留下半个文件**
   - 旧行为：`ProjectManager.write` 直接 `writeText`，先截断再写。
   - 处理：临时文件 + `fd.sync()` + `rename` 覆盖；失败才退化直接写。`LocalWorkspace.writeBytes`、`CheckpointStore.writeAtomic` 同步补 fsync。
   - 位置：`ProjectManager.write`、`LocalWorkspace.writeBytes`、`CheckpointStore.writeAtomic`。

3. **`onStop` 的保存是异步 launch，进程可能在写盘前被杀**
   - 旧行为：`saveOnBackground()` 只调用 `save()`，内部 `viewModelScope.launch` 异步写。
   - 处理：`saveOnBackground()` 改为同步写（编辑器单文件已限制 5MB），按快照比对后再清 `dirty`。
   - 位置：`EditorViewModel.saveOnBackground`。

4. **超大文件/二进制文件可被直接点开，`readText` 导致 OOM/ANR**
   - 处理：`ProjectManager.read` 加 5MB 上限 + NUL 字节二进制探测，超限给出可理解提示；`doOpenFile` 捕获异常并回滚 Tab。
   - 位置：`ProjectManager.read`、`EditorViewModel.doOpenFile`。

5. **Agent `replaceLines` 绕过 2MB 文本上限**
   - 处理：`LocalWorkspace.replaceLines` 在 `readLines()` 前检查 `MAX_TEXT_BYTES`。
   - 位置：`LocalWorkspace.replaceLines`。

6. **检查点 `snapshot` 直接 `readBytes()`，大文件 OOM**
   - 处理：单文件 8MB 上限；`restore` 也检查 blob 大小。
   - 位置：`CheckpointStore.snapshot/restore`。

7. **SAF 导入边读边写目标文件，失败留下半截文件且无大小限制**
   - 处理：隐藏临时文件 + 8KB 流式拷贝 + 32MB 上限 + fsync + rename；失败删除临时文件。
   - 位置：`EditorViewModel.importFile`。

### P1 生命周期 / 资源 / 状态

8. **返回键关终端只把 overlay 置 None，PTY shell 继续跑**
   - 处理：`closeOverlay()` 在关闭 Terminal 时调用 `vm.closeTerminal()`；PTY writer/队列/桥一起停。
   - 位置：`EditorScreen.closeOverlay`、`EditorViewModel.stopPty`。

9. **关闭 Agent 面板不取消 Agent，读工具可能继续在后台执行**
   - 处理：`closeOverlay()` 在 Agent 忙碌时调用 `vm.cancelAgent()`；面板自身的 dismiss 仍保留取消。
   - 位置：`EditorScreen.closeOverlay`。

10. **Agent 改文件后用磁盘内容覆盖未保存编辑**
    - 处理：`reloadAfterAgent` 发现 `dirty` 时不覆盖，只提示并刷新文件树；更新前再次比对当前文件/脏状态。
    - 位置：`EditorViewModel.reloadAfterAgent`。

11. **撤销 Agent 检查点会覆盖当前未保存修改**
    - 处理：`restoreAgentCheckpoint` 在 `dirty` 时直接拒绝并提示先保存/关闭。
    - 位置：`EditorViewModel.restoreAgentCheckpoint`。

12. **检查点 blob 永不回收，反复修改/撤销持续吃存储**
    - 处理：快照后 `gc()`：只保留最近 20 份清单，删除无任何清单引用的 blob；删除检查点后也回收。删除失败的旧清单仍被视为引用，避免误删。
    - 位置：`CheckpointStore.gc/delete`。

13. **Agent 会话 JSONL 无单文件上限**
    - 处理：单会话 16MB 封顶；回放最多 2000 条；保留 30 份且总量 128MB，从最旧会话开始删。
    - 位置：`AgentSessionStore`。

14. **`ExecutionService.stop` 在 Android O+ 用 `startService`，后台调用可能被系统拒绝**
    - 处理：同进程内直接持有弱引用实例，`Handler` 主线程调用 `stopTag`；无实例才退回 `stopService`。
    - 位置：`ExecutionService`。

15. **前台服务只保进程，不保证 CPU 不休眠，熄屏长脚本可能被挂起**
    - 处理：服务启动时申请 `PARTIAL_WAKE_LOCK`，最后一个任务停止/服务销毁时释放；Manifest 增加 `WAKE_LOCK`。
    - 位置：`ExecutionService`、`AndroidManifest.xml`。

16. **PTY JNI 回调抛异常后未清理，后续 JNI 调用可能连锁失败**
    - 处理：`call_bytes` 调 `CallVoidMethod` 后 `ExceptionCheck/ExceptionClear`。
    - 位置：`ptybridge.c`。

17. **删除当前文件后 `dirty` 未复位**
    - 处理：删除文件/目录时，若当前文件在其下，清空 `currentFile/editorText` 并 `dirty=false`，同时移除其下所有 Tab。
    - 位置：`EditorViewModel.deleteFile`。

18. **重命名目录不更新目录下已打开 Tab**
    - 处理：目录重命名时按旧前缀迁移 `currentFile` 和所有 `openTabs`，并更新语言标签。
    - 位置：`EditorViewModel.renameFile`。

19. **文件树构建无总节点上限，超大项目可能卡死**
    - 处理：单次构建 10,000 节点预算，超出静默截断，优先保证 UI 可用。
    - 位置：`ProjectManager.buildTree`。

20. **分享/复制输出可能超过 Binder 事务上限**
    - 处理：分享/剪贴板统一 200KB 截断；输出单行 4000 字符截断，避免一条超大输出先打爆内存。
    - 位置：`EditorViewModel.outputTextForSharing/appendLines`、`EditorScreen` 分享入口。

21. **编辑器双指捏合手势抢走单指滚动/光标拖动**
    - 处理：`detectTransformGestures` 改为只在两指及以上时消费事件的自定义 `awaitEachGesture`，单指事件不消费。
    - 位置：`CodeEditorView`。

22. **App 内切换深色主题后状态栏图标不跟随**
    - 处理：`LaunchedEffect(dark)` 设置 `isAppearanceLightStatusBars/isAppearanceLightNavigationBars`。
    - 位置：`MainActivity`。

23. **AI 非流式响应无体积上限，异常端点可能返回超大 JSON**
    - 处理：`readCapped` 限制 2MB 字符后再解析。
    - 位置：`AiClient`。

24. **运行/新建/导入/删除等 IO 异常会以未捕获协程异常闪退**
    - 处理：`doOpenFile`、`startRun` 保存、`newProject`、`newFile`、`newFileInCurrentDir`、`newFolderInCurrentDir`、`deleteFile`、`deleteProject` 统一 `runCatching` + 用户提示。
    - 位置：`EditorViewModel`。

25. **`RunCommandTool` 超时只 destroy sh，子进程握着管道导致 reader 挂住**
    - 处理：超时强杀 + 关闭输入流；Android `Process` 无 `ProcessHandle`，子进程树仍无法彻底枚举（见待处理）。
    - 位置：`RunCommandTool.destroyTree`。

## 二、尚未处理（已记录，建议下一批）

### P1

26. **`NativeEngine` 对不响应中断的脚本没有真正复位**
    - 现象：脚本卡在不可中断 C 调用时，UI 8 秒后强制翻回可运行，但引擎 `busy=true`，再次运行提示“已有程序在运行中”，只能重启 App。
    - 原因：`busy` 只在 `execFile` 返回的 `finally` 复位；不能用 `shutdown()` 强杀解释器而不破坏后续运行。
    - 建议：单独的解释器进程/可重启子进程，或提供“强制重启运行时”按钮（明确告知会丢失当前解释器状态）。

27. **`forkpty` 子进程里调用 `setenv`，不是 async-signal-safe**
    - 位置：`ptybridge.c` 的 `pid==0` 分支。
    - 风险：多线程进程 fork 后 `setenv` 可能 malloc 死锁；概率低，但终端起不来时很难排查。
    - 建议：fork 前构造 envp，子进程只 `execle`；或接受继承环境，去掉 `setenv`。

28. **`RunCommandTool` 子进程树无法彻底杀掉**
    - Android 的 `java.lang.Process` / `ProcessBuilder` 不暴露 `ProcessHandle`；当前只能强杀 sh 并关闭管道。
    - 建议：用 `sh -c 'exec ...'` 减少中间层，或原生 `process group` 管理。

29. **`ProjectManager.deleteProject` 的返回值不可靠**
    - `deleteRecursively()` 返回 Boolean，但方法返回 Unit；调用方 `isSuccess` 只能判断异常，不能判断“没删掉”。建议改为 Boolean 并显示失败。

### P2

30. **文件树截断没有 UI 提示**
    - 超过 10,000 节点时静默截断；用户会以为文件丢了。建议 `FileNode` 增加 `truncated` 标记并在树顶提示。

31. **`AgentSessionStore.metaOf` 仍会把单份 16MB 日志读成 List**
    - 已封顶但读取峰值仍高；建议只读首行 + 流式统计。

32. **`SettingsStore.save` 在主线程同步写 EncryptedSharedPreferences**
    - 每次调字号/高度都会走 Keystore；低端机可能掉帧。建议状态先更新，落盘 debounce 到 IO。

33. **可访问性**
    - 仍有 9sp/10sp 小字、固定 sp 布局；系统字体 200% 时状态栏/按钮/对话框可能再次溢出；深色 `faint` 对比度偏低。建议做 fontScale 2.0 的 Compose 预览/截图回归。

34. **大文件预览**
    - Markdown/HTML 预览把整段文本交给渲染器；5MB 上限下仍可能产生很大的 HTML。建议预览单独限制 512KB。

35. **终端大段粘贴队列无上限**
    - PTY 输入队列是 UNLIMITED；一次粘贴几十 MB 会占内存。建议设置 1MB 队列上限并提示。

36. **`onCleared` 未统一释放 PTY/引擎**
    - Activity 销毁（非返回键关面板）时目前依赖 `closeTerminal`；建议 `onCleared` 兜底停 PTY，运行中的 Python 引擎需谨慎处理。

## 三、功能性缺口（不是 bug，但影响大）

37. **只能 SAF 导入单个文件，不能导入整个文件夹/仓库**
    - 换机、误删、迁移项目时无法整体恢复。建议增加“项目 zip 导出/导入”。

38. **没有 Git clone**
    - 目前只能本地建项目；与“移动端 CodePocket”定位有落差。

39. **没有 instrumentation/UI 测试与截图回归**
    - 0.0.30/0.0.31 的布局、Dialog、IME、返回键行为只靠 JVM 单测 + 编译 + lint；没有真实 Android 交互验收。

40. **没有 ARM64 真机验收**
    - x86_64 TCG 模拟器仍卡在 `emulator-5556 offline`；PTY、16KB 页、WebView xterm、软键盘 inset 均需 ARM64 真机确认。

## 四、本轮验证

- Kotlin 编译：`:app:compileDebugKotlin` 成功。
- JVM 单测：**137 个通过**（新增 1 个检查点 GC 测试），0 failures。
- lint Release：**0 Error / 37 Warning**（新增 1 条 WakeLock 无超时警告；无 Fatal）。
- 未取得 Android 真机/模拟器截图；本轮不伪造运行图。

## 五、后续版本处理结果

### 0.0.33 已处理

- 29 删除项目返回值：`ProjectManager.deleteProject` 已返回 Boolean。
- 31 会话日志读取：`AgentSessionStore.metaOf` 已改单遍流式读取。
- 35 PTY 粘贴无上限：输入队列 256、单次 64KB 上限。
- 36 onCleared 未释放 PTY/引擎：`EditorViewModel.onCleared()` 已统一取消 Job、停 PTY、释放引擎。

### 0.0.34 已处理

- 27 forkpty `setenv`：`ptybridge.c` 已改为 fork 前构造 `argv`/`envp`，子进程只 `chdir` + `execve`。
- 28 命令子进程树：新增 `ProcessGroup`，`/system/bin/setsid` + 负 PID `SIGTERM`/`SIGKILL`；setsid 缺失时退化为直接子进程，已接入 `RunCommandTool` 与 `TerminalSession`。
- 37 项目整体迁移：新增 `ProjectArchive` zip 导入/导出，带 Zip Slip、绝对路径、盘符与体积/条目上限。
- 38 没有 Git clone：`GitManager.cloneInto` 支持 HTTPS clone，token 走 JGit 凭据提供器，不写 `.git/config`。
- 26 NativeEngine 无法复位：**仅部分处理**。新增 `engineStuck` 检测与输出面板「重启应用」入口，保存当前文件后重拉进程；没有实现解释器进程隔离，卡在不可中断 C 调用时仍只能重启应用。

### 0.1.0 已处理

- 26 NativeEngine 无法复位：**真正进程隔离**。新增 `EngineHostService`（`android:process=":engine"`）与 `RemoteNativeEngine`，主进程不再加载 JNI；卡死时 `hardReset()` 只杀引擎进程，编辑器/未保存内容不受影响。协议有 `EngineRpcTest`；仍无 Android 真机运行验收。
- 30 文件树截断 UI 提示：`FileNode.truncated` + 树顶文案，`FileTreeBuilderTest` 覆盖预算/深度/传播。
- 32 `SettingsStore.save` 主线程同步写加密盘：敏感字段改为单线程合并后台写，`onStop`/`onCleared` flush；`SettingsStoreTest` 覆盖读回与连续保存。
- 33 可访问性：`MonoText` 最小 11sp；`ComposeSmokeTest` 在 fontScale 2.0 下打开设置页。
- 34 大 Markdown/HTML 预览：`PreviewLimiter` 512K 上限 + `PreviewPane` 截断提示，原文不动；`PreviewLimiterTest` 覆盖。
- 39 UI 测试：Robolectric + Compose 冒烟覆盖文件树截断、Git Diff、大字号设置页；仍是 JVM 侧，不是 instrumentation 真机测试。

### 仍未处理

- 40 ARM64 真机验收：本机无 `/dev/kvm`，0.1.0 的引擎进程、Git UI、文件树/预览、wheel 导入都没有 Android 运行截图；这是唯一保留的发布前人工门禁，不伪造。
