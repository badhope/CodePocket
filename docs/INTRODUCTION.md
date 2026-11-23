# CodePocket「口袋码」—— 项目介绍

> 一句话：**真正离线的安卓多语言 IDE，Python / JavaScript / Lua 装完就能跑，另有 17 种语言可编辑。**

---

## 它是什么

CodePocket 是一款完全离线的安卓多语言 IDE。Python 由 NDK 交叉编译的 CPython 3.13 原生库执行，JavaScript/Lua 由纯 Java 的 Rhino/LuaJ 执行，三者都随 APK 打包——安装后打开就能写代码、跑代码，全程不需要联网、不需要下载运行时、没有广告。

**核心承诺：装完即离线。** 地铁上、课堂上、没有信号的山里，只要手机在手，代码就能跑。

---

## 为什么值得用

### 对学习者
- 打开即用的 Python 环境，不用配置任何东西；
- 20+ 高频错误的"人话翻译"，报错不再是天书；
- 内置模板、命令面板、AI 助手（可选），从"照着写"到"自己写"一路顺畅。

### 对脚本写手 / 极客
- 原生 ARM64 / x86_64 性能，跑计算脚本不卡壳；
- 真文件系统：脚本直接读写手机私有目录，cwd 就是项目目录；
- 标准库全量：math / json / socket / ssl / sqlite3 / ctypes 等 C 扩展随包可用；
- JGit 离线 Git：init / commit / push / pull 都能在手机上完成。

### 对所有人
- **开源**（Apache-2.0）：代码透明，可审查、可 fork、可贡献；
- **无广告无内购**：没有会员墙，功能不藏着掖着；
- **隐私友好**：代码和数据都在设备本地，AI 助手由用户自配端点（BYOK）。

---

## 它能做什么

| 场景 | 说明 |
|---|---|
| 写代码 | 多文件 Tab、文件树、语法高亮（18 种语言 TextMate）、静态补全、查找替换、全局搜索 |
| 跑代码 | 原生 CPython 3.13、流式输出、`input()` 交互、死循环超时中断、命令行参数 |
| 管项目 | 多项目切换、4 个 Python 模板、SAF 导入导出、离线 Git |
| 看结果 | Markdown / HTML 分屏预览、PNG 图片直接查看、输出复制与分享 |
| 提效率 | 命令面板 ⌘K、AI 助手（BYOK）、会话恢复、崩溃日志本地留存 |

---

## 技术底色

- **引擎**：Python 为 CPython 3.13.9（PEP 738，arm64 / x86_64 原生库）；JavaScript 为 Rhino 1.7.15、Lua 为 LuaJ 3.0.1（纯 Java，无 native 依赖）；
- **桥接**：Python 走自写 JNI 桥（`pybridge.c`），三路 stdio；JS/Lua 复用同一套 `RunEngine` 事件流；
- **界面**：Kotlin 2.0 + Jetpack Compose + Sora Editor；
- **构建**：零外部申请依赖——NDK（Google 官方）+ CPython 源码（GitHub）+ BeeWare 预编译依赖，全部免费公开。

---

## 诚实的能力边界

- Python 运行：✅ 完整（原生 CPython 3.13，arm64 + x86_64）；
- JavaScript / Lua 运行：✅ 纯 Java，任意 ABI；
- Java / Kotlin / TypeScript 等 14 种语言：仅编辑、高亮与补全，不提供运行；
- numpy / pandas / matplotlib：⚠️ **未预装**，离线导入第三方 wheel 的能力后续开放；
- pip 联网装包：❌ 离线定位，不提供在线包安装。

---

## 一起建设

CodePocket 是开源项目，欢迎一切形式的参与：提交 Issue、改进文档、修 bug、加功能、帮忙测试。

- 贡献指南：[CONTRIBUTING.md](../CONTRIBUTING.md)
- 路线图：[ROADMAP.md](ROADMAP.md)
- 行为准则：[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)

---

*CodePocket「口袋码」——把 IDE 装进口袋，离线也能写代码。*
