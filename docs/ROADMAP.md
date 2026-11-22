# CodePocket 路线图（Roadmap）

> 状态图例：✅ 已完成 · 🔄 进行中 · 📋 规划中

---

## 已实现（v0.0.14 基线）

- ✅ 三种可运行语言：Python（原生 CPython 3.13，ARM64）、JavaScript（Rhino，纯 Java）、Lua（LuaJ，纯 Java）
- ✅ JNI 桥：stdin/stdout/stderr 三路桥接、死循环中断、`input()` 交互
- ✅ 标准库全量随包（纯 Python + C 扩展：math/json/socket/ssl/sqlite3/ctypes…）
- ✅ Sora Editor 编辑器（20 种语言高亮、补全、查找替换、全局搜索；3 种可运行 + 17 种编辑级）
- ✅ 文件树 / 多 Tab / 项目模板 / 多项目切换 / SAF 导入导出
- ✅ 离线 Git（JGit：init/commit/push/pull）
- ✅ Markdown / HTML 分屏预览、PNG 查看
- ✅ 友好报错翻译（20+ 高频错误）、报错行点击跳转
- ✅ AI 助手（BYOK，OpenAI 兼容端点）
- ✅ 会话恢复、前台服务保活、崩溃日志
- ✅ 修复：`__file__` 等模块属性注入、并发运行状态机、停止兜底

---

## 进行中（v1.1 目标）

- 🔄 第三方科学计算库离线支持：numpy / pandas / matplotlib 的 ARM64 wheel 随包
  - 途径：本地交叉编译 wheel 或预构建 wheel 打包，离线导入；
  - 依赖：构建工具链扩展（`scripts/` 新增 wheel 打包流程）。
- 🔄 离线包管理增强：图形化导入 `.whl`、模块可用性清单
- 🔄 官网站点更新：品牌页 + 下载 + 文档（`site/` 目录）

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
