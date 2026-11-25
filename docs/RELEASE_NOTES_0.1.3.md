# CodePocket 0.1.3 — 项目级文本引用查找

**版本号**：0.1.3（versionCode 43）  
**发布日期**：2026-11-26  
**定位**：0.0.27「跳转到定义」之后的 LSP-lite 第二步。不启动语言服务器、不下载模型，离线给出标识符在项目中的文本级出现位置。

## 问题

0.0.27 已经能从光标标识符跳到项目内的 `def` / `class` / 模块变量定义，但反过来「它还在哪里被用」只能靠全局搜索逐条看。搜索面板给的是文本命中，不区分是不是同一个符号，也没有“定义”标记。

## 实现

- 项目符号索引新增 `Reference(path, name, line, column, preview, isDefinition)` 与 `references(name, fromPath, limit = 200)`。
- 扫描规则与定义索引保持一致：只扫 `.py`，最多 300 个文件，单文件上限 512KB，最多返回 200 条；按当前文件优先、路径、行号、列号排序。
- 用完整标识符边界匹配，`mycallback` 或 `callback_extra` 不会命中 `callback`；支持 Unicode 标识符校验。
- 编辑器光标取词复用已有 `wordAt`，新增「查找引用」命令；非 Python 文件、光标不在标识符上、零结果都有明确提示。
- 新增 `ReferenceDialog`：显示引用数量、文件、`Lx:y` 行号列号、整行预览和「定义」标记；点击结果直接打开对应文件并跳到所在行。
- 命令面板增加 `references`（查找引用）；新增 `References` overlay 状态，接入编辑器弹窗。

## 明确边界

- **这是文本级引用，不是语义引用**：注释、字符串和同名局部变量都会被算进去；不解析作用域、不做类型推断、不区分属性归属。
- **不自动改名**：本版只负责“看清楚它出现在哪”，不提供 rename/refactor，避免把文本匹配当成安全的重构依据。
- **不是完整 LSP**：没有 language server 进程、没有编译数据库、没有跨语言引用；索引上限与 0.0.27 相同。
- 仍无 ARM64 真机验收；不冒充所有 ROM 都已跑通。

## 构建与测试

- 全量 `testDebugUnitTest`：45 个 XML，**184 tests / 0 failures / 0 errors / 0 skipped**。
- `lintRelease`：**0 errors / 27 warnings**。
- release APK `24,339,656 B`，SHA-256 `9b579ab71f6118bb5aaa26bd7f4edc2af2c67ed431fa108fb484ab352f0a0524`。
- debug APK `43,457,810 B`，SHA-256 `ec72b6eeac7457863d8c9270e44e4d074973d0a9660711d8bfd0d473e26d2e31`。
- `aapt` 确认 `versionCode=43`、`versionName=0.1.3`；签名证书 SHA-256 与 0.1.2 相同：`1b02135746d1426d7beda47e706fdb2c77a7145ea41e0f7e14addb191b87fac5`。
- `zipalign -c -p 4` 通过；121 个 `.so` 全部 16KB LOAD 对齐（`0x4000`）。

## 真实验收

在 x86_64 Android 15（API 35，1080×2340，TCG 软件模拟）上安装 0.1.3 release APK，用 `main.py` / `helpers.py` 的 `callback` 实测：

- 光标放在 `main.py L7:12`，命令面板执行「查找引用」，弹窗显示 `“callback”的引用（6）`，并标注文本级边界。
- 6 条结果：`main.py L1:21 / L3:3 / L5:22 / L7:12`，`helpers.py L1:5`（定义）与 `L6:16`；`mycallback`、`callback_extra` 两个子串没有误命中。
- 点击 `helpers.py L1:5` 后打开 `helpers.py`，光标位于 `Ln 1, Col 1` 的 `def callback(value):`。
- 证据截图见 `screenshots-0.1.3/01-引用列表.png` 与 `02-点击跳转helpers定义.png`；详细记录见交付页 `VERIFICATION_0.1.3.md`。

这只是 x86_64 模拟器的 release 包验收，不作为 ARM64 真机结论。
