# 第三方组件声明（NOTICE）

本产品包含或依赖以下第三方开源组件，在此致谢并声明其许可证：

## 1. SoraEditor（代码编辑器组件）

- 项目地址：https://github.com/Rosemoe/sora-editor
- 许可证：**LGPL-2.1**
- 使用方式：通过 Maven（`io.github.Rosemoe.sora-editor:editor / language-java / language-textmate`）
  以公开 API 动态链接。
- 合规说明：本项目源码已按 Apache-2.0 开源，符合 LGPL 对动态链接的要求；
  用户可自行替换该库。若你 fork 本项目后闭源分发，请保证最终用户能获得
  或替换该库，并保留本声明。

## 2. CPython（原生 Python 运行时）

- 项目地址：https://github.com/python/cpython
- 许可证：**PSF License**（Python 3.13.9，官方源码，PEP 738 Android 支持交叉编译）
- 使用方式：`libpython3.13.so`（arm64）随 APK 打包于 `jniLibs/`，由 `libpybridge.so`
  （自写 JNI 桥）加载；纯 Python 标准库打包为 `assets/python-stdlib.zip`。
- 附带组件：zlib（zlib License）、OpenSSL（Apache-2.0，`libssl_python`/`libcrypto_python`）、
  SQLite（Public Domain，`libsqlite3_python`）——均为 CPython 官方构建所捆绑。

## 3. 第三方科学计算库（numpy / pandas 等）

- **当前版本未预装**。历史版本（Pyodide 原型）曾内置 numpy/pandas 的 wasm32 wheel，
  已随原生引擎迁移下线；离线安装第三方 wheel 的能力在路线图中。
- 如未来随包分发 wheel，将在此处补充各库的许可证声明（numpy BSD-3、pandas BSD-3 等）。

## 4. JGit（Git 实现，纯 Java）

- 项目地址：https://www.eclipse.org/jgit/
- 许可证：**EDL 1.0**（Eclipse Distribution License，即 BSD-3-Clause）。
- 使用方式：通过 Maven（`org.eclipse.jgit:org.eclipse.jgit`）以公开 API 动态链接，
  提供 init / status / commit / push / pull 能力，无外部二进制依赖。
- 附带组件：SLF4J（`slf4j-api` / `slf4j-nop`，MIT）。

## 5. org.jetbrains:markdown（Markdown 解析，实时预览）

- 项目地址：https://github.com/JetBrains/markdown
- 许可证：**Apache-2.0**。
- 使用方式：通过 Maven（`org.jetbrains:markdown`）以公开 API 动态链接，
  提供 GFM 方言的 Markdown → HTML 渲染（预览面板）。

## 6. 编辑器 TextMate 主题（Monokai / Solarized / Tomorrow Night Blue）

- 来源：**Visual Studio Code** 内置主题（https://github.com/microsoft/vscode，
  `extensions/theme-*`），已转换为 tm4e 兼容格式并去除注释。
- 许可证：**MIT**（VS Code 项目）。版权与许可声明随文件与仓库分发保留。

## 7. llama.cpp（本地 GGUF 推理）

- 项目地址：https://github.com/ggml-org/llama.cpp
- 许可证：**MIT**
- 使用方式：以官方源码交叉编译为 Android arm64 静态库，再由自写 JNI
  （`native/llama_jni/llama_jni.cpp`）薄封装为 `libllama_jni.so` 随 APK 分发。
- 合规说明：APK 内二进制由 llama.cpp 源码构建；源码与构建脚本见仓库 `native/` 与文档。
- 模型权重（MiniCPM5-1B / 2B GGUF）：**Apache-2.0**，不随 APK 分发，由用户在
  ModelScope 页面下载，遵循模型卡条款。

## 8. AndroidX / Jetpack Compose / Kotlin / androidx.webkit

- 许可证：Apache-2.0
- 通过 Maven Central 分发的官方 Android 组件。

## 9. xterm.js（终端模拟器）

- 项目地址：https://github.com/xtermjs/xterm.js
- 许可证：**MIT**
- 使用方式：`xterm.js 5.5.0` 与 `@xterm/addon-fit 0.10.0` 以静态文件形式随 APK
  打包在 `app/src/main/assets/terminal/`，由本地 WebView 加载；不访问网络。
- 许可证原文：`app/src/main/assets/terminal/LICENSE-xterm.txt`。

---

本项目自身代码以 Apache License 2.0 发布，详见 [LICENSE](LICENSE)。


## Qwen3.5-2B 模型权重

- 来源：Qwen/Qwen3.5-2B（Apache-2.0），GGUF 量化为 unsloth/Qwen3.5-2B-GGUF。
- 分发方式：不随 APK 打包，由用户在应用内单独下载；下载地址使用 ModelScope 国内源。
