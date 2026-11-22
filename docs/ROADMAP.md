# CodePocket 路线图（Roadmap）

> 状态图例：✅ 已完成 · 🔄 进行中 · 📋 规划中

---

## 已实现（v0.0.16 Agent 验证）

- ✅ Agent 事件流：`SessionStarted / UserMessage / ToolCall / ToolResult / PatchProposed / Approval / PatchApplied / Checkpoint / Failure / SessionFinished`
- ✅ `LocalWorkspace` 路径监狱、行窗口读取、目录列表、文本搜索、按行替换
- ✅ ACI 工具：`read_file` / `list_files` / `search_text` / `apply_patch`，全部限制输出大小
- ✅ `AgentLoop`：JSON 决策协议、最多 8 步、写前审批、失败回读
- ✅ `CheckpointStore`：SHA-256 内容寻址快照，不污染用户 Git 仓库
- ✅ Agent 面板：工具轨迹、观察结果、diff、批准/拒绝、停止
- ✅ 云端 `ModelProvider`（OpenAI 兼容端点，复用 `AiClient`）
- ✅ `run_file` / `run_tests`：受限执行项目内文件，Python unittest discover，输出尾部回读
- ✅ Agent 面板「撤销本次 Agent 修改」：确认后从最近检查点恢复

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
- ✅ Release 构建：R8 压缩后 APK 从 95MB 降到约 32MB，JNI/运行时 keep 规则已补齐
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
- 📋 多架构支持：x86_64 模拟器包（当前仅 arm64）

### 开发体验
- 📋 调试器（断点/单步/变量查看）
- 📋 代码格式化（Black/ruff 风格）与 lint
- 📋 终端面板（真实 PTY 风格，可跑交互命令）

### 生态与平台
- 📋 应用商店上架（GitCode Releases / 第三方商店）
- 📋 模板市场：社区贡献项目模板
- 📋 插件机制（语言服务器协议 LSP 支持）
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
