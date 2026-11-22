# CodePocket 开源生态融合计划

> 路线：B —— 离线口袋 Agent。不是做手机版 OpenCode，而是把「工作区 + Agent 循环 + 结构化工具 + 检查点 + 验证」这条脊柱装进 Android。
> 原则：能复用成熟开源实现就复用；只自研 Android 特有的桥接层和产品交互。

---

## 1. 结论

当前 CodePocket 的问题不是功能少，而是功能之间没有同一条主线。下一阶段不再按「加一个面板、加一个 AI 按钮」推进，而是按下面的固定顺序：

```
Workspace（文件/路径/索引）
    ↓
AgentSession（事件日志 + 检查点）
    ↓
AgentLoop（模型 → 工具 → 观察 → 再决策）
    ↓
ToolRegistry（6 个 ACI 工具 + 权限）
    ↓
ContextBuilder（仓库地图 + 规则 + 当前错误）
    ↓
UI（时间线 + Diff + 批准）
```

先有这条线，再加 MCP、插件、子 Agent、多会话。否则每加一块都会变成新的孤岛。

---

## 2. 参考项目与「只抄哪一刀」

| 项目 | 核心机制 | CodePocket 复用什么 | 不复用什么 |
|---|---|---|---|
| **OpenHands** | append-only 事件流、Workspace 抽象、可回放 | `AgentEvent` 日志、`Workspace` 接口、会话恢复 | Docker 沙箱、WebSocket 服务端、Python SDK |
| **Goose** | Interface / Agent / Extension 三层，标准 agent loop | 循环状态机、ToolRegistry/Extension 注册、上下文裁剪 | Rust 运行时、桌面端、MCP 市场 |
| **OpenCode** | TUI 是 client，agent 在 server；OpenAPI 多客户端 | 进程内 `AgentService` 与 UI 解耦；未来可换本地 server | TUI、200+ provider、桌面端 |
| **Aider** | tree-sitter repo map、whole/diff/udiff 编辑格式、Git 提交 | RepoMap 思路、按文件大小选编辑格式、自动 checkpoint | 终端交互、LiteLLM 全量 provider |
| **Cline** | 每步 shadow Git checkpoint、diff、逐动作批准 | 三种 restore 语义、diff 审核、ApprovalPolicy | VS Code Webview、MCP 市场 |
| **SWE-agent** | ACI：为 LM 设计的文件查看/搜索/按行编辑/lint 反馈 | 6 个结构化工具与输出上限 | 原始 Linux shell、SWE-bench harness |
| **AIDE-Plus / AndroidIDE** | Android 原生 IDE + AI 改文件 + diff/undo + LSP/Gradle | 移动端交互、diff/undo 的用户预期 | 完整 Gradle 构建系统；GPL 代码不直接搬 |
| **Acode** | proot Alpine + 终端 + 可跑 Claude Code/Codex/OpenCode | 移动端「工作区」产品形态参考 | 全量 Linux 层（除非单独做可选模块） |
| **llama.cpp** | GGUF 端侧推理，Android NDK 可编译 | 本地模型运行时、JNI、mmap/量化 | 不自己训练模型 |
| **PocketPal** | 端侧 GGUF、模型下载、工具调用循环 | 模型下载/内存管理/本地 provider 交互 | 不照搬其 UI 和推理引擎 |

参考来源：

- OpenHands events: https://docs.openhands.dev/sdk/arch/events
- OpenHands 论文: https://arxiv.org/pdf/2407.16741.pdf
- Goose architecture: https://block.github.io/goose/docs/goose-architecture/
- OpenCode server: https://opencode.ai/docs/server/
- Aider repo map: https://aider.chat/docs/faq.html
- Cline checkpoints: https://docs.cline.bot/core-workflows/checkpoints
- SWE-agent ACI: https://arxiv.org/html/2405.15793v1
- Acode: https://acode.app/android-ide
- AndroidIDE: https://github.com/AndroidIDEOfficial/AndroidIDE
- llama.cpp Android: https://github.com/ggml-org/llama.cpp

---

## 3. 目标架构

### 3.1 模块树

```
com.devterminal
├── workspace/                 # 纯 JVM，无 Android 依赖
│   ├── Workspace.kt           # 读写/列目录/搜索/路径校验
│   ├── LocalWorkspace.kt
│   └── FileIndex.kt           # 轻量仓库地图
├── agent/
│   ├── AgentEvent.kt          # 追加式事件
│   ├── AgentSession.kt        # 会话状态 + 事件日志
│   ├── AgentLoop.kt           # 状态机
│   ├── AgentService.kt        # 进程内运行时，UI 只订阅
│   ├── ApprovalPolicy.kt
│   ├── ContextBuilder.kt
│   ├── CheckpointStore.kt     # 内容寻址快照
│   └── tools/
│       ├── ReadFileTool.kt
│       ├── ListFilesTool.kt
│       ├── SearchTextTool.kt
│       ├── ApplyPatchTool.kt
│       ├── RunFileTool.kt
│       └── RunTestsTool.kt
├── model/
│   ├── ModelProvider.kt       # 云/本地统一接口
│   ├── OpenAiCompatibleProvider.kt
│   ├── LocalLlamaProvider.kt
│   ├── ModelCatalog.kt        # 可下载模型清单
│   └── ModelDownloadManager.kt
├── language/
│   ├── LanguageService.kt     # 符号/诊断/引用
│   ├── PythonAstService.kt
│   ├── JavaScriptAstService.kt
│   └── LuaAstService.kt
└── ui/
    ├── agent/AgentSheet.kt
    ├── agent/DiffReview.kt
    └── agent/ApprovalCard.kt
```

`workspace`、`agent`、`model` 不依赖 Compose；`ui` 只消费事件。这样 `EditorViewModel` 才能从 1360 行降下来。

### 3.2 事件模型

```kotlin
sealed interface AgentEvent {
    val id: String
    val at: Long

    data class SessionStarted(...) : AgentEvent
    data class UserMessage(...) : AgentEvent
    data class Plan(...) : AgentEvent
    data class ToolCall(...) : AgentEvent
    data class ToolResult(...) : AgentEvent
    data class PatchProposed(...) : AgentEvent
    data class Approval(...) : AgentEvent
    data class PatchApplied(...) : AgentEvent
    data class Checkpoint(...) : AgentEvent
    data class RunResult(...) : AgentEvent
    data class Error(...) : AgentEvent
    data class SessionFinished(...) : AgentEvent
}
```

会话存成 `JSONL`，只追加不覆盖。UI 时间线、会话恢复、调试回放都从这条日志派生。上下文压缩只影响「喂给模型的消息」，不删除原始事件。

### 3.3 Agent 循环

```
Idle
  → Planning（模型给计划，不改文件）
  → ToolCall（模型请求工具）
  → WaitingApproval（策略要求批准）
  → Executing（执行工具）
  → Observing（结果写回事件流）
  → Verifying（跑测试/运行）
  → Done / Failed
```

硬限制：

- 最多 8 步；
- 单工具 30 秒；
- 连续 2 次相同失败就停，交给用户；
- 任何步骤都可取消；
- 没有批准不写文件、不跑命令。

### 3.4 ACI 工具

| 工具 | 参数 | 限制 | 返回 |
|---|---|---|---|
| `read_file` | path, start, end | 最多 120 行，文件 ≤2MB | 行号、总行数、省略提示 |
| `list_files` | depth | 最多 500 条，跳过 `.git/build/node_modules` | 相对路径列表 |
| `search_text` | query, glob | 最多 50 条 | 文件:行号 + 命中行 |
| `apply_patch` | path, start, end, replacement | 1-based 行区间；语法检查失败不落盘 | 应用后的窗口 |
| `run_file` | path, args | 超时、输出截断 | exitCode + stdout/stderr 尾部 |
| `run_tests` | target | 先支持 Python unittest | 失败测试名 + traceback |

`apply_patch` 优先于整文件重写：模型对行号范围的控制力比统一 diff 稳。大文件用行区间，小文件（<120 行）才允许整文件替换。

### 3.5 检查点

不直接复用 Cline 的 shadow Git 实现，采用更适合 Android 的内容寻址快照：

```
filesDir/checkpoints/
├── blobs/<sha256>          # 文件内容只存一份
└── snapshots/<id>.tsv      # path<TAB>hash
```

每次 `apply_patch` / `run` 前自动快照。恢复时按路径逐个写回，并校验 hash。这样不污染用户 Git 仓库，也不需要维护隐藏 worktree。

### 3.6 上下文

- 项目规则：`AGENTS.md` / `.codepocket/rules.md`
- 仓库地图：文件 + 符号 + import；Python 用 CPython `ast`，JS 用 Rhino parser，Lua 用 LuaJ parser
- 排序：当前打开文件 5x、import 关系 3x、最近修改 2x、路径匹配 1x（不照搬 PageRank）
- 预算：规则 10%、仓库地图 25%、相关文件 45%、当前错误 20%
- 压缩：保留用户目标、已批准决定、未解决错误；删除寒暄和重复观察

---

## 4. 开源组件引入清单

| 组件 | 许可证 | 引入方式 | 体积/风险 | 阶段 |
|---|---|---|---|---|
| **llama.cpp** | MIT | NDK 编译 `libllama.so` / `libggml*.so`，arm64-v8a，JNI 薄封装 | +4–6MB；16KB 对齐；R8 keep | P3 |
| **JGit** | EDL/BSD | 已引入，继续用于 Git | 已有 | 已完成 |
| **java-diff-utils** | Apache-2.0 | 若 Gradle 可解析则用；否则 vendor jar | ~100KB；diff 展示 | P1 |
| **MCP Kotlin SDK** | Apache-2.0 | 仅 P5 接 HTTP/SSE；先不引 | 依赖较多 | P5 |
| **SoraEditor** | LGPL-2.1 | 已引入；保留可替换性 | 已有 | 已完成 |
| **Rhino / LuaJ** | MPL-2.0 / MIT | 已引入 | 已有 | 已完成 |
| **OpenHands/Goose/Aider/Cline/SWE-agent** | 各自开源 | **只复用架构/算法，不直接拷代码**；GPL 项目只参考交互 | 无 | 全程 |

依赖策略：

1. 能在现有 Gradle 镜像解析的，走 `libs.versions.toml`；
2. 解析失败的，优先 vendor 官方 jar/AAR，并记录来源与 SHA-256；
3. 不为了一个功能引入一整套框架；
4. 所有新增 native `.so` 必须检查 16KB LOAD 对齐。

---

## 5. 本地模型选型（2026-11 调研）

### 5.1 结论

| 档位 | 模型 | 参数 | 许可 | 量化体积 | 适用设备 | 定位 |
|---|---|---|---|---|---|---|
| **默认（严格 <2B）** | **MiniCPM5-1B** | 1.08B | Apache-2.0 | INT4 ~0.5GB；GGUF Q4 ~0.6GB | 6GB+ RAM | 1B 级 SOTA，工具调用/代码最强 |
| **可选（2B 级）** | **MiniCPM5-2B** | 2.52B 总参 / 1.98B 非嵌入 | Apache-2.0 | INT4 ~1.2GB | 8GB+ RAM | 2B 级综合最强，端侧 Agent 雏形 |
| **备选（严格 <2B）** | **Qwen3.5-2B** | 1.89B | Apache-2.0 | Q4 ~1.34GB | 8GB+ RAM | 中文稳定、生态成熟，Agent 分数较低 |
| **低端机** | Qwen3.5-0.8B | 0.76B | Apache-2.0 | Q4 ~507MB | 4–6GB RAM | 快，但复杂 Agent 能力弱 |

**默认下载选项选 MiniCPM5-1B（Q4_K_M）**；设备 ≥8GB 时提供 MiniCPM5-2B 可选。两者都不进 APK，首次使用时下载。

### 5.2 依据与注意事项

- MiniCPM5-1B 官方称 1B 级开源 SOTA，平均分 42.57；对比 Qwen3.5-0.8B 25.14、Qwen3-0.6B 26.77；τ²-Bench Telecom-AA 79.53，代码与工具调用是强项。来源：https://www.modelscope.cn/models/OpenBMB/MiniCPM5-1B-GGUF
- MiniCPM5-2B 官方称 AA 综合 23、Agentic Index 20，4B 以下第一；但独立 Artificial Analysis 给出 15，存在厂商/独立口径差异。对外不能说“绝对第一”，只能说“2B 级第一梯队”。来源：https://www.openbmb.cn/model/minicpm5-2b 、https://ai-tldr.dev/models/minicpm5-2b/
- Qwen3.5-2B 为 1.89B，严格低于 2B；GGUF Q4 约 1.34GB，Qwen 官方支持 llama.cpp。来源：https://github.com/QwenLM/Qwen3.5
- MiniCPM5-2B 总参 2.52B，严格说超过「2B 以下」。如果约束不可破，只上 MiniCPM5-1B；如果按「2B 级」理解，可提供 2B 选项。
- 手机内存经验：模型文件 + KV cache + ~20% 开销；6GB 手机跑 1B Q4，8GB 跑 2B Q4，context 先 2048，别默认 128K。来源：https://hanyuliu.me/posts/running-llama-cpp-on-android/

### 5.3 本地模型接入方式

- **运行时**：llama.cpp，`arm64-v8a`，`mmap` 加载，CPU 4 线程；P3 不接 GPU。
- **下载**：ModelScope 优先，`getExternalFilesDir("models")`，支持断点/校验 SHA-256/删除；前台服务保活。
- **工具调用**：MiniCPM 原生 XML tool call；llama.cpp 没有 SGLang parser，需要在 Kotlin 实现 `MiniCpmToolCallParser`，失败后一次 JSON 修复；再失败就退回「文本计划 + 用户确认 patch」。
- **Provider**：实现 `ModelProvider`，与云端口同一接口；UI 只显示「云端 / 本地」。
- **设备门槛**：6GB 推荐 1B，8GB 推荐 2B；加载前检查 `ActivityManager.memoryClass` 与可用空间，不足则禁用下载。
- **合规**：模型单独下载，不在 APK 内；展示许可证与来源；不把模型权重提交到 Git。

---

## 6. 分阶段计划

### Phase 0：脊柱骨架（先不碰 UI）

- [x] `AgentEvent`、`Tool`、`Workspace`、`CheckpointStore` 四个基础类型
- [x] `LocalWorkspace` 路径监狱、读文件窗口、列目录、搜索
- [x] `ModelProvider` 接口（云端 provider 已接）
- [x] 单元测试：路径越界、行窗口、搜索上限、快照恢复
- [x] 把 `rootProject.name` 改为 `CodePocket`

验收：`:app:testDebugUnitTest` 通过；不改变现有 UI 行为。

### Phase 1：ACI 工具 + 补丁 + 批准

- [x] 6 个工具，先实现 `read/list/search/apply_patch`
- [x] `ApprovalPolicy`：读自动、写/跑必须批准
- [x] `CheckpointStore` 接入 patch 前快照
- [x] `AgentLoop` 用云端口跑通（先不接本地模型）
- [x] UI：Agent 抽屉、时间线、diff、批准卡片

验收：10 文件 Python 项目，改 2 文件，跑 unittest，失败后读 traceback 再修，undo 能回滚。

### Phase 2：上下文与语言智能

- [x] `RepoMap`：关键词排序 + 符号提取（Python/Kotlin/Java/JS/TS/Lua）
- [x] `AGENTS.md` / `.codepocket/rules.md`
- [x] 会话 JSONL 持久化、恢复、压缩
- [x] `LanguageService`：符号大纲（6 种语言），诊断留待 AST 阶段
- [x] `run_tests` 接 unittest

验收：20 文件项目，Agent 只读相关 3–5 个文件就能提出正确 patch；杀进程重开恢复会话。

### Phase 3：本地模型

- [x] llama.cpp NDK 构建 + JNI + 16KB 检查
- [x] `ModelCatalog`：
  - MiniCPM5-1B GGUF Q4（默认）
  - MiniCPM5-2B GGUF Q4（8GB+ 可选）
  - Qwen3.5-2B GGUF Q4（备选）
- [x] 下载管理、校验、删除、存储占用
- [x] `LocalLlamaProvider`（文本 JSON 协议；XML parser 待接原生 tool call）
- [x] 设置页/命令面板「本地模型」入口与内存门槛提示

验收：8GB 手机飞行模式，完成一次「读文件 → patch → 跑测试」；1B 模型首 token < 2s、>5 tok/s（目标值，实测再调）。

### Phase 4：生态扩展

- [x] `ProviderRegistry`（云端/本地，统一可用性判断）
- [x] MCP client（Streamable HTTP + SSE data，只读工具自动执行、副作用工具审批）
- [x] 项目技能目录：`.codepocket/skills/*.md` 注入提示词（最多 3 个文件 / 1500 字符）
- [x] 命令面板自定义命令：`.codepocket/commands` 下的 Markdown 填入 Agent
- [x] 多会话：最近 20 个会话回放 / 删除，文件保留 30 个
- [x] 项目 JS 插件：`.codepocket/plugins` + Rhino 沙箱，默认关闭，仅 `run(input)`

---

## 7. 不做清单

- 不做终端 TUI；
- 不做完整 proot Linux（除非单独可选模块，且先做体积/性能评估）；
- 不做 200+ 模型提供商；
- 不做 MCP 市场/插件市场；
- 不做云端后端；
- 不把模型权重打进 APK；
- 不为每个面板加 AI 按钮。

---

## 8. 风险与对策

| 风险 | 对策 |
|---|---|
| R8 裁剪 JNI/llama 符号 | `-keep class com.devterminal.model.**`、native 方法 keep、release 实测 |
| 16KB 页对齐 | 每个 `.so` `readelf -lW` 检查 `0x4000` |
| 模型下载失败/断点 | 前台服务 + Range + SHA-256 + 可删除重试 |
| 手机内存不足 | 设备门槛、context 2048、加载失败明确提示 |
| 厂商跑分虚高 | UI 标注「厂商评测」，不承诺绝对排名；默认 1B 更稳 |
| GPL 代码污染 | AndroidIDE/AIDE-Plus 只参考交互，不拷代码 |
| Gradle 依赖解析失败 | 优先已有依赖；必须引入的 vendor jar 并记录 SHA |

---

## 9. 第一批落地（已实现）

Phase 0 骨架：

- `agent/AgentEvent.kt`：事件类型
- `agent/Tool.kt`：工具调用/结果
- `workspace/Workspace.kt`、`LocalWorkspace.kt`
- `agent/CheckpointStore.kt`
- 对应 JVM 单测

Phase 1 首批：

- `agent/AgentDecision.kt`：文本 JSON 决策协议
- `agent/AgentLoop.kt`：工具循环、审批、检查点、失败回读
- `agent/tools/*`：六个 ACI 工具（含 `run_file` / `run_tests`）
- `model/ModelProvider.kt`、`model/OpenAiCompatibleProvider.kt`
- `ui/AgentPanel.kt` + AI 面板入口


---

## 10. 落地记录（2026-11-22）

- Phase 0 / Phase 1 已完成首批：`6dd9363` + 本次提交。
- ACI：`read_file` / `list_files` / `search_text` / `apply_patch`，全部有输出上限。
- `AgentLoop` 支持 JSON 决策协议、最多 8 步、写前审批、内容寻址检查点、失败回读。
- UI：AI 助手内新增「Agent 模式」入口，Agent 面板显示工具轨迹、观察结果、diff 与批准按钮。
- 单测：`testDebugUnitTest` 70 个用例通过；`assembleDebug` / `assembleRelease`（跳过 lintVital）通过。
- `run_file` / `run_tests` 已接：运行项目内可运行文件、Python unittest discover，输出尾部回读。
- Agent 面板新增「撤销本次 Agent 修改」，确认后从最近检查点恢复。
- 未做：本地 llama.cpp、RepoMap、真机验证。
