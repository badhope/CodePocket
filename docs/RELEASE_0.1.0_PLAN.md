# CodePocket 0.1.0 发布计划：可信移动 IDE

生成时间：2026-11-25  
定位：0.0.34 之后第一次跨小数位发布。不是再加几个面板，而是把“能不能长期当主力 IDE 用”的底座补齐。

---

## 1. 上一份计划到底完成没有

结论：**功能骨架完成，发布级质量门禁没完成。**

《开源生态融合计划》Phase 0–4 的代码项基本都已落地：Workspace、Agent 事件/检查点、ACI 工具、上下文、本地模型、MCP、技能/命令/插件、多会话都已存在。  
但 0.0.31 风险清单仍有 5 项未处理、1 项只做了一半：

| 编号 | 项目 | 0.0.34 状态 | 0.1.0 处理 |
|---|---|---|---|
| 26 | NativeEngine 无法复位 | 部分处理：卡死检测 + 重启应用 | 改为 `:engine` 独立进程，支持只重启引擎 |
| 30 | 文件树截断无提示 | 未处理 | 增加 `truncated` 标记与顶部提示 |
| 32 | SettingsStore 主线程写加密盘 | 未处理 | 非敏感立即写，敏感字段单线程合并落盘 |
| 33 | 9/10sp 小字、fontScale 2.0 | 未处理 | `MonoText` 最小 11sp；补大字号 UI 冒烟 |
| 34 | 大 Markdown/HTML 预览内存 | 未处理 | 预览 512KB 上限 + 明确截断提示 |
| 39 | 无 instrumentation/UI 测试 | 未处理 | Robolectric + Compose UI 冒烟测试 |
| 40 | 无 ARM64 真机验收 | 未处理 | 本机无设备，保留为发布前人工门禁，不伪造 |

## 2. 同行对比：我们缺什么

| 能力 | Termux | Pydroid 3 | Acode | AndroidIDE | CodePocket 0.0.34 | 0.1.0 |
|---|---|---|---|---|---|---|
| 离线多语言运行 | 需装包 | Python | 需装包 | Java/Kotlin | Python/JS/Lua | 保持 |
| 真实终端 | ✅ | 部分 | 插件 | ✅ | ✅ PTY/xterm | 保持 |
| Git 克隆/提交/推送 | ✅ CLI | ❌ | ✅ | ✅ | ✅ 基础 | **补 stage/unstage/diff** |
| 代码补全/LSP | ✅ CLI | 部分 | 插件 | ✅ | 静态补全 + 符号 | 不冒充 LSP，文档明确 |
| 图形化调试 | CLI | ✅ | ❌ | ✅ | pdb 终端式 | 保持，不冒充图形调试器 |
| 包管理 | apt/pip | pip | 插件 | Gradle | 纯 Python zip 导入 | 补 wheel 元数据与安装结果 |
| Android 工程构建 | ✅ 手写 | ❌ | ❌ | ✅ Gradle | ❌ | 明确不在 0.1.0，避免假承诺 |
| 插件生态 | 包管理 | ❌ | ✅ | 部分 | 项目 JS 插件 | 保持，文档标边界 |
| 移动端适配 | 终端 | 专用 UI | ✅ | ✅ | 0.0.30 布局治理 | 补大字号/小屏回归 |
| 真机矩阵 | 社区 | 商业 | 商业 | 社区 | 无 | 仍缺，必须人工验收 |

**不装懂**：0.1.0 不试图变成 AndroidIDE。Gradle/Java/Kotlin 编译、完整 LSP、原生 wheel ABI 适配都不在当前包体积和离线约束内；这些不能靠一句“已支持”糊过去。

## 3. 0.1.0 必须交付

### P0 可靠性

1. **Python 引擎独立进程**
   - 新增 `EngineHostService`，`android:process=":engine"`。
   - 主进程只保留 `RemoteNativeEngine`，通过 Messenger 传 run/stdin/stop/event。
   - 引擎卡死时，`hardReset` 只杀 `:engine` 进程，主编辑器/未保存内容不受影响。
   - 输出面板“重启应用”改为“重启引擎”；只有引擎进程起不来才提示重启 App。
2. **Git 审阅闭环**
   - 单文件 stage/unstage、全部暂存、工作区 diff。
   - Diff 上限 200KB，超出截断并提示。
3. **剩余风险 30/32/33/34** 全部关闭。

### P1 体验

4. 离线包导入支持 `.whl`/`.zip`，解析 `dist-info` 名称与版本；安装失败不留下半包。
5. 文件树截断、预览截断都有可见文案，不静默。
6. 设置写盘不阻塞主线程；连续拖拽只落最后一版。

### 质量门禁

- `:app:testDebugUnitTest` 全绿，新增测试覆盖引擎协议、Git stage/diff、预览上限、文件树截断。
- `:app:lintRelease` 0 Error。
- `assembleRelease` 成功；APK 双 ABI、16KB 对齐、签名一致。
- Robolectric/Compose UI 冒烟：文件树截断提示、Git Diff 对话框、fontScale 2.0 设置页不崩。
- 无真机则明确写“未做 ARM64 真机验收”，不生成假截图。

## 4. 版本与发布

- `versionCode = 40`，`versionName = "0.1.0"`。
- 五仓 main + `v0.1.0` tag + Release。
- 官网、README、CHANGELOG、ARCHITECTURE、FAQ、ROADMAP、USER_GUIDE、风险清单同步。

## 5. 明确不做

- 不集成 Gradle/Java/Kotlin 编译器。
- 不伪装 LSP；当前仍是符号索引 + 静态补全。
- 不把原生 `.whl` 当作可安装；只支持纯 Python wheel。
- 不做云端后端、不做插件市场、不把模型权重打进 APK。

---

## 6. 执行结果（2026-11-25）

状态：**0.1.0 代码、测试、APK、文档、五仓 main/tag/Release 已完成；唯一未关闭项是 ARM64 真机验收。**

| 门禁 | 结果 |
|---|---|
| 引擎独立进程 | ✅ `EngineHostService` + `RemoteNativeEngine` + JSON Messenger 协议；协议测试通过 |
| Git 审阅 | ✅ stage/unstage/stageAll/commitStaged/diff；删除文件暂存、大文件/二进制边界测试通过 |
| 风险 30/32/33/34 | ✅ 文件树截断、设置后台写、11sp 下限 + fontScale 2.0 冒烟、预览 512K |
| 纯 Python 包 | ✅ wheel/zip 安装、原生产物拒绝、路径穿越拦截、中途失败回滚测试通过 |
| JVM/Robolectric | ✅ 171 tests / 0 failures / 0 errors |
| lintRelease | ✅ 0 Error / 27 Warning |
| assembleRelease | ✅ 24,327,148 B，双 ABI，16KB 对齐，签名证书 SHA-256 `1b02135746d1426d7beda47e706fdb2c77a7145ea41e0f7e14addb191b87fac5` |
| ARM64 真机 | ❌ 无设备/模拟器；不伪造截图，保留人工门禁 |
| 五仓发布 | ✅ GitHub origin / fork / X33834、Gitee、GitCode 的 `v0.1.0` tag、Release 与双 APK 资产均已确认 |

**范围说明**：用户提出“对比同行缺什么全部补完整”。本版在“当前离线包体 + 无 JVM/Gradle 工具链”的现实约束下，补齐了 Git 审阅、包导入、引擎隔离、预览/文件树/设置写盘与大字号 UI 冒烟；Gradle/Java/Kotlin 工程构建、完整 LSP、原生 wheel ABI 仍明确不做，不能在 0.1.0 里假装支持。
