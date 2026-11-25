# CodePocket 路线图（Roadmap）

> 状态图例：✅ 已完成 · 🔄 进行中 · 📋 规划中

---

## 已实现（v0.0.33 资源收尾）

- ✅ ViewModel `onCleared` 统一停止 PTY、取消后台 Job、释放 NativeEngine/RuntimeRegistry
- ✅ 会话列表流式读取，单份 16MB 日志不再整份进内存；删除项目返回真实 Boolean
- ✅ PTY 输入队列 256 容量、单次写入 64KB 上限
- ✅ 移除旧 `usrtar.zip` 工具链说明，避免“安装包漏文件”的误解；标准库剔除 test/idlelib/turtledemo，`python-stdlib.zip` 从 11.43MB 降到 4.32MB
- ✅ Git 文案对齐实际能力：init / commit / push / pull，不宣称 clone
- ✅ 全局面板 edge-to-edge + IME 安全布局：标题/输入框/按钮固定，正文滚动；设置、AI、Agent、Git、搜索、终端在软键盘上方完整可见
- ✅ 终端全屏自适应：PTY 主体按剩余高度伸缩，Esc/Tab/Ctrl/方向键条贴键盘上方；非 PTY 输入框固定底部
- ✅ 输出面板高度分离用户偏好与当前可见值，键盘弹起不覆盖设置；展开 stdin 输入行通常至少 220dp，极矮屏降至 150dp
- ✅ 横竖屏判断改用系统方向，键盘不会把竖屏误切成左右分栏
- ✅ Snackbar 让位状态栏；顶栏、状态栏、输出头、文件 Tab 的长文本省略/滚动
- ✅ 关闭自动保存时切文件/关 Tab/切项目先询问保存/放弃/取消，不再静默丢改动
- ✅ 原子保存（临时文件 + fsync + rename）、`onStop` 同步落盘；5MB/二进制文件打开护栏
- ✅ 返回键关终端停止 PTY、关闭 Agent 面板取消 Agent；目录重命名/删除同步 Tab 生命周期
- ✅ 检查点 blob 回收、会话日志 16MB/128MB 上限、分享/剪贴板 200KB 上限
- ✅ 前台执行 partial wakelock；同进程安全停服务；PTY FIFO 输入；JNI 回调异常清理
- ✅ Python pdb 调试：第一行停顿、`b <行>` 断点、`n`/`s`/`c`、`p locals()`、`w` 调用栈、`q` 退出；输出面板快捷条
- ✅ 真实 PTY + ANSI 终端：`forkpty` + `/system/bin/sh -i`，原始字节交给本地 xterm.js 5.5.0；颜色、光标定位、备用屏、滚动回看可用，`vim`/`top`/`less` 正常显示；窗口尺寸经 `TIOCSWINSZ` 同步
- ✅ 跨文件 Python 定义索引：`class` / `def` / 模块级变量，import 感知排序，文件/行号/签名可选
- ✅ 命令面板「跳转到定义」，光标取词，结果多选不猜；索引上限 300 个 `.py` / 单文件 512KB
- ✅ 正式 release 签名（独立 RSA-4096 证书，密钥不入库，构建可回退 debug）
- ✅ x86_64 CPython 3.13 交叉编译、JNI 桥与 53 个 C 扩展，arm64 + x86_64 双 ABI
- ✅ 编辑器终端面板：项目内 cwd、`cd`/`pwd`、超时与输出截断；非 PTY 轻量会话 + 0.0.29 xterm.js PTY 终端双模式
- ✅ 只读子 Agent `delegate_task`：隔离上下文探索，不写文件/不执行命令
- ✅ 离线 `semantic_search`：TF-IDF 语义索引，返回路径/行号/相关度

## 已实现（v0.0.25 Agent 工作流）

- ✅ Agent 事件流：`SessionStarted / UserMessage / ToolCall / ToolResult / PatchProposed / Approval / PatchApplied / Checkpoint / Failure / SessionFinished`
- ✅ `LocalWorkspace` 路径监狱、行窗口读取、目录列表、文本搜索、按行替换
- ✅ ACI 工具：`read_file` / `list_files` / `search_text` / `apply_patch`，全部限制输出大小
- ✅ `AgentLoop`：JSON 决策协议、最多 8 步、写前审批、失败回读
- ✅ `CheckpointStore`：SHA-256 内容寻址快照，不污染用户 Git 仓库
- ✅ Agent 面板：工具轨迹、观察结果、diff、批准/拒绝、停止
- ✅ 云端 `ModelProvider`（OpenAI 兼容端点，复用 `AiClient`）
- ✅ `run_file` / `run_tests`：受限执行项目内文件，Python unittest discover，输出尾部回读
- ✅ Agent 面板「撤销本次 Agent 修改」：确认后按逆序恢复整轮全部检查点
- ✅ `RepoMapBuilder`：任务关键词排序、符号提取、2200 字符预算、大文件与二进制跳过
- ✅ `ContextBuilder`：系统提示词预算、RepoMap 裁剪、历史消息按字符预算压缩
- ✅ 项目规则：兼容 `AGENTS.md` / `CLAUDE.md` / `.cursorrules` / `.windsurfrules` / `.github/copilot-instructions.md` / `.codepocket/rules.md`，注入 Agent 提示词
- ✅ Agent 计划模式：先 `Plan`、再审批、后执行，面板/设置双入口
- ✅ Agent 跨轮上下文：同一会话携带上一轮目标与结论，支持新会话
- ✅ 上下文 token 估算与双预算裁剪，面板显示上下文规模
- ✅ 多 Provider 预设（DeepSeek / 硅基流动 / 智谱 / 月之暗面 / Ollama）
- ✅ AI 助手会话持久化（最近 40 条）与 429/5xx 退避重试
- ✅ MCP resources / prompts 桥接；Agent 终端命令工具
- ✅ Agent 文件 IO 全部切到 `Dispatchers.IO`，扫描项目不再阻塞主线程
- ✅ `LanguageService`：Python / Kotlin / Java / JS / TS / Lua 文件符号大纲，行号可跳转
- ✅ 命令面板新增「符号大纲」，当前文件函数/类一屏看完，点击直达
- ✅ Agent 会话 JSONL：每次任务落盘，重启自动恢复最近一次时间线
- ✅ Agent 历史会话：最近 20 个会话可回放、删除，保留 30 个文件
- ✅ llama.cpp JNI：arm64 `libllama_jni.so`，静态链接 llama/ggml，16KB 对齐
- ✅ 本地模型管理：MiniCPM5-1B / 2B、Qwen3.5-2B 下载、断点续传、SHA-256 校验、删除
- ✅ `LocalLlamaProvider`：Agent 可完全离线跑本地 GGUF，6GB/8GB 内存门槛
- ✅ 设置页与命令面板新增「本地模型」入口
- ✅ `ProviderRegistry`：云端/本地可用性判断收敛到一处
- ✅ 项目技能目录：`.codepocket/skills` 下的 Markdown 注入 Agent 提示词

## v0.0.14 基线


- ✅ 三种可运行语言：Python（原生 CPython 3.13，ARM64）、JavaScript（Rhino，纯 Java）、Lua（LuaJ，纯 Java）
- ✅ JNI 桥：stdin/stdout/stderr 三路桥接、死循环中断、`input()` 交互
- ✅ 标准库随包（2314 条纯 Python 模块，剔除 5247 个 `__pycache__`；C 扩展走 jniLibs：math/json/socket/ssl/sqlite3/ctypes…）
- ✅ Sora Editor 编辑器（20 种语言高亮、补全、查找替换、全局搜索；3 种可运行 + 17 种编辑级）
- ✅ 文件树 / 多 Tab / 项目模板 / 多项目切换 / SAF 导入导出
- ✅ 离线 Git（JGit：init/commit/push/pull）
- ✅ Markdown / HTML 分屏预览、PNG 查看
- ✅ 友好报错翻译（20+ 高频错误）、报错行点击跳转
- ✅ AI 助手（BYOK，OpenAI 兼容端点）
- ✅ 会话恢复、前台服务保活、崩溃日志
- ✅ 修复：`__file__` 等模块属性注入、并发运行状态机、停止兜底
- ✅ 数据完整性：切项目/关脏 Tab/打开文件前强制落盘，保存失败即中止操作
- ✅ 安全加固：预览断网、SAF 文件名清洗、Zip Slip 路径校验、Git token 不落盘
- ✅ 16KB 页对齐：`libpybridge.so` 与 jniLibs 全部 58 个 `.so` 均为 `0x4000`
- ✅ 解释器隔离：每次运行后清理用户新增 `sys.modules` 与 `sys.path` 改动
- ✅ 输出完整性：三引擎 1024 缓冲 + 100ms/256 行分批上屏 + 丢行统计
- ✅ 错误与诊断：完整 Python traceback、Java/原生崩溃日志 About 页出口
- ✅ Release 构建：R8 压缩后 APK 从 95MB 降到约 39MB（含 6.6MB 本地推理桥），JNI/运行时 keep 规则已补齐
- ✅ AI 流式回复支持 180s 总超时、120s 空闲超时与手动取消

---

## 进行中（v1.1 目标）

- 🔄 第三方科学计算库离线支持：numpy / pandas / matplotlib 的 ARM64 wheel 随包
  - 途径：本地交叉编译 wheel 或预构建 wheel 打包，离线导入；
  - 依赖：构建工具链扩展（`scripts/` 新增 wheel 打包流程）。
- 🔄 离线包管理增强：图形化导入 `.whl`、模块可用性清单
- ✅ 官网站点更新：CodePocket 品牌页、下载、文档与社交卡片（`site/` 目录；演示视频仍为早期录屏）

---

## 规划中（v1.2+）

### 运行时
- 📋 Java 运行时集成（JVM/ART 直跑或 openjdk 精简运行时）——解除"Java 仅编辑"的边界
- 📋 JavaScript/TypeScript 运行时（QuickJS 或类似，轻量随包）
- ✅ 多架构支持：x86_64 模拟器包（v0.0.26 完成）

### 开发体验
- ✅ Python pdb 调试（终端式；图形化变量树/DAP 仍在规划）
- ✅ 真实 PTY 后端 + 完整 ANSI 终端模拟器（xterm.js，0.0.29）
- ✅ 移动端 edge-to-edge / IME 安全布局与输出面板高度治理（0.0.30）
- 📋 代码格式化（Black/ruff 风格）与 lint

### 生态与平台
- ✅ MCP 工具 / 项目自定义命令 / Rhino 沙箱插件
- 📋 应用商店上架（GitCode Releases / 第三方商店）
- 📋 模板市场：社区贡献项目模板
- 📋 插件机制（语言服务器协议 LSP 支持；当前只有符号大纲，不是 LSP）
- 📋 CI 流水线：GitHub Actions 自动构建 + 冒烟测试
- 📋 真机测试矩阵（不同厂商 Android 版本）

### 工程化
- 📋 单元测试补全：引擎状态机、pybridge C 测试（宿主 CPython 模拟）
- 📋 端到端测试对齐原生引擎（现 test_suite.py 仍是 Web 原型驱动）
- 📋 崩溃上报（可选、用户授权）

---

## 原则

1. **离线优先**：任何新能力默认要求"装完即用"，不依赖联网；
2. **零外部申请依赖**：工具链只使用免费公开物（NDK / CPython / 开源库）；
3. **诚实标注**：能力边界写进 README，不吹不藏；
4. **小步快跑**：每个版本一个核心主题，先稳定再扩展。

---

*想参与某个方向的开发？见 [CONTRIBUTING.md](../CONTRIBUTING.md)，在 Issue 里认领或开新 Issue 讨论。*
