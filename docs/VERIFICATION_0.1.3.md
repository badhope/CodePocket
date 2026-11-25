# CodePocket 0.1.3 验收记录

**版本**：0.1.3（versionCode 43）  
**日期**：2026-11-26  
**范围**：项目级文本引用查找的构建、JVM/Compose 测试与模拟器 UI 验收。

## 1. 构建门禁

| 项目 | 结果 |
| --- | --- |
| `testDebugUnitTest` | 45 个 XML / **184 tests / 0 failures / 0 errors / 0 skipped** |
| `lintRelease` | **0 errors / 27 warnings** |
| release APK | 24,339,656 B |
| debug APK | 43,457,810 B |

release SHA-256：

```text
9b579ab71f6118bb5aaa26bd7f4edc2af2c67ed431fa108fb484ab352f0a0524  CodePocket-0.1.3-release.apk
```

debug SHA-256：

```text
ec72b6eeac7457863d8c9270e44e4d074973d0a9660711d8bfd0d473e26d2e31  CodePocket-0.1.3-debug.apk
```

## 2. 包体检查

- `aapt dump badging`：`package: name='com.devterminal' versionCode='43' versionName='0.1.3'`。
- 签名证书 SHA-256：`1b02135746d1426d7beda47e706fdb2c77a7145ea41e0f7e14addb191b87fac5`，与 0.1.2 相同。
- `zipalign -c -p 4` 通过；121 个 `.so` 全部 16KB LOAD 段对齐到 `0x4000`。

## 3. 功能验收（x86_64 Android 15 模拟器）

环境：Android 15（API 35）x86_64 模拟器，1080×2340，TCG 软件模拟；安装的是 0.1.3 release APK（24,339,656 B）。

测试项目为 `python-hello`：

- `main.py`：`from helpers import callback`；注释提到 `callback`；`local_callback = callback(3)`；`return callback(4)`。
- `helpers.py`：`def callback(value)`、`def mycallback()`、`def callback_extra()`，以及一行注释。

步骤与结果：

1. 打开 `main.py`，把光标放在第 7 行第 12 列的 `callback`（状态栏显示 `Ln 7, Col 12`）。
2. 命令面板执行「查找引用」，弹窗标题显示 `“callback”的引用（6）`，并明确标注“文本级结果：包含注释、字符串和同名局部变量；按当前文件优先排序。”
3. 列表共 6 条，与预期一致：
   - `main.py L1:21` — `from helpers import callback`
   - `main.py L3:3` — `# callback is mentioned in this comment too`
   - `main.py L5:22` — `local_callback = callback(3)`
   - `main.py L7:12` — `return callback(4)`
   - `helpers.py L1:5` — `def callback(value):`，带「定义」标记
   - `helpers.py L6:16` — 注释中的 `callback`
4. **边界反例**：`helpers.py` 里的 `def mycallback()` 与 `def callback_extra()` 没有出现在结果中，证明完整标识符边界有效；`local_callback` 也没有作为子串命中。
5. 点击 `helpers.py L1:5` 一行，弹窗关闭，实际打开 `helpers.py`，光标落在 `Ln 1, Col 1` 的 `def callback(value):`。

证据截图：

- `screenshots-0.1.3/01-引用列表.png`：`main.py` 第 7 行 `callback` 光标 + 6 条引用列表 + 文本级说明。
- `screenshots-0.1.3/02-点击跳转helpers定义.png`：点击定义后打开 `helpers.py`，第 1 行 `def callback(value):`。

说明：这是 TCG 纯软件模拟器上的 release 包 UI 验收，只能证明 x86_64 Android 15 环境；不代表 ARM64 真机结果。
