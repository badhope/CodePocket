# CodePocket 0.1.0 — 可信移动 IDE

**版本号**：0.1.0（versionCode 40）  
**发布日期**：2026-11-25  
**定位**：0.0.34 之后第一次跨小数位发布。重点是把 Python 引擎、Git 审阅、包安装和质量门禁补成能长期使用的地基。

---

## 这版真正改变了什么

### 1. Python 引擎独立进程

- Python 运行在 `android:process=":engine"` 的 `EngineHostService`，主进程只保留 `RemoteNativeEngine` 代理，不再加载 `libpython` / `libpybridge`。
- 主/引擎进程通过 `Messenger + JSON` 交换 prepare、run、stdin、stop 和全部 `RunEvent`；协议有往返测试。
- 输出栏「重启引擎」只杀 `:engine` 进程，编辑器缓冲、未保存内容、Git 与终端都不受影响，不再重启整个 App。
- prepare 期间进程死亡会立即失败，不再干等 120 秒；引擎事件流异常会补发 `Failed` 终态，避免 UI 永远停在“运行中”。

### 2. Git 审阅闭环

- 单文件「暂存 / 取消暂存」、全部暂存；提交只提交暂存区，空暂存会拒绝。
- 点变更文件查看 Diff：工作区 vs 暂存区优先，未跟踪文件显示全加行；超过 200KB 截断。
- 大文件/二进制不再强行读进内存：未跟踪文件只读前 200KB，二进制不解码，`DiffFormatter` 有界输出。
- `stageAll` 覆盖删除文件；同一路径暂存后再修改显示 `MM`。

### 3. 0.0.31 剩余风险关闭

- 文件树超过 10,000 项顶部显示截断提示。
- Markdown/HTML 预览限制 512K 字符，编辑器原文不动。
- 设置加密字段改为单线程合并后台写，`onStop`/`onCleared` 主动落盘。
- `MonoText` 最小 11sp；设置页在 fontScale 2.0 下有 Compose 冒烟。
- 纯 Python `.whl` / `.zip` 导入：解析名称/版本，拒绝原生 `.so/.pyd/.dll/.dylib/.wasm` 与路径穿越，失败逆序回滚。

### 4. 质量门禁

- JVM/Robolectric 单测：**171 通过 / 0 失败 / 0 错误**。
- `lintRelease`：**0 Error / 27 Warning**。
- `assembleRelease` 成功；release APK 双 ABI（arm64-v8a / x86_64），`zipalign -c -p 4` 通过，正式证书 SHA-256 `1b02135746d1426d7beda47e706fdb2c77a7145ea41e0f7e14addb191b87fac5`。
- Compose 冒烟覆盖：文件树截断提示、Git Diff 对话框、fontScale 2.0 设置页。

---

## 资产

| 文件 | 大小 | SHA-256 |
|---|---:|---|
| `CodePocket-0.1.0-release.apk` | 24,327,148 B | `70dd026c8fd3991830ce6a2c46537fb7defff5673ea08af0d1db681351f8354a` |
| `CodePocket-0.1.0-debug.apk` | 44,030,182 B | `1c576b03dcb4e6be220256440977d7e4865035a9d830c772930cc05ab8d630af` |

release 包使用正式 RSA-4096 证书；debug 包仅用于侧载调试，签名不同，不能覆盖安装 release。

---

## 诚实边界

- **未做 ARM64 真机验收**：本机无 `/dev/kvm`，x86_64 TCG 模拟器反复失败；引擎进程、Git UI、文件树/预览、wheel 导入没有 Android 运行截图。本版不伪造运行图，真机手感仍需按机型人工验收。
- **不做 Gradle/Java/Kotlin 工程构建**：APK 不带 JVM/Gradle 工具链，不冒充 AndroidIDE。
- **不提供完整 LSP**：仍是符号索引 + 静态补全，不做类型推断/继承解析/重命名。
- **不支持含原生 `.so` 的 wheel**：当前 CPython 包体不带这些 ABI 依赖，安装器会在写盘前拒绝。
- **不做在线 pip / 云端后端 / 插件市场**：离线优先定位不变。

---

## 升级建议

- 从 0.0.34 直接覆盖安装 0.1.0 release；首次启动仍会解压标准库。
- 若之前把 AI Key / Git token 存在旧版明文偏好，升级时会自动迁移到加密偏好；极少数 Keystore 不可用 ROM 会回退明文并在设置页提示。
- 升级后第一次运行 Python 会重新预热 `:engine` 进程；之后运行不需要额外等待。

---

*CodePocket「口袋码」— 把 IDE 装进口袋，离线也能写代码。*
