<div align="center">

# 📱 CodePocket 口袋码

**A truly offline multi-language IDE for Android — Python, JavaScript and Lua run out of the box, 17 more languages stay editable on your phone.**

Three runtimes are bundled inside the APK: a natively cross-compiled CPython 3.13, Rhino for JavaScript and LuaJ for Lua. Zero downloads, zero network, zero ads, zero subscriptions.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Android-8.0%2B-green?style=flat-square)](https://developer.android.com)
[![Kotlin](https://img.shields.io/badge/Kotlin%202.0%20%2B%20Compose-7F52FF?style=flat-square)](https://kotlinlang.org)
[![Runtime](https://img.shields.io/badge/Runtime-100%25%20bundled-orange?style=flat-square)]()
[![Ads](https://img.shields.io/badge/Ads-0-red?style=flat-square)]()

**[Download APK](https://gitcode.com/badhope/CodePocket/releases)** · **[Website](https://badhope.github.io/CodePocket/)** · **[Gitee Mirror](https://gitee.com/badhope/CodePocket)**

> Keep your IDE in your pocket — code offline, anywhere.

</div>

---

## ✨ Why CodePocket

| | Termux | Pydroid 3 | Acode | Spck | **CodePocket** |
|---|:---:|:---:|:---:|:---:|:---:|
| Offline after install | ⚠️ extra setup | ⚠️ partial | ❌ needs network | ❌ needs network | ✅ **runtime bundled** |
| Modern IDE UI | ❌ terminal only | ⚠️ dated | ✅ | ✅ | ✅ |
| Multi-file tabs / find & replace | ❌ | ✅ | ✅ | ✅ | ✅ |
| Offline Git + stage/diff | ✅ | ❌ | ✅ | ✅ | ✅ **JGit + review** |
| Native performance | ✅ | ✅ | — | — | ✅ **native ARM64/x86_64 + pure-Java runtimes** |
| AI assistant (BYOK) | ❌ | ❌ | ✅ cloud | ✅ cloud | ✅ **custom endpoint** |
| Open source & ad-free | ✅ GPL | ❌ paid | ⚠️ ads | ⚠️ IAP | ✅ **Apache-2.0** |

> Our positioning: **open source + ad-free + offline after install + native performance**.

---

## 📸 Screenshots & Demo

| Onboarding | Running | Output |
|---|---|---|
| ![Onboarding](design/screenshots/01-onboarding.png) | ![Running](design/screenshots/03-running.png) | ![Output](design/screenshots/04-output-done.png) |

| Git | AI Assistant | Command Palette |
|---|---|---|
| ![Git](design/screenshots/10-git.png) | ![AI](design/screenshots/11-ai.png) | ![Command Palette](design/screenshots/12-command-palette.png) |

### Demo Video

<video src="design/promo.mp4" controls></video>

[▶ Download demo video](design/promo.mp4) · 24s · 0.6MB · no audio

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────┐
│  Compose UI layer                            │
│  file tree · editor (Sora) · output · cmd    │
└──────────────────┬──────────────────────────┘
                   │ JNI (jobject callbacks)
┌──────────────────▼──────────────────────────┐
│  Main process                                │
│  RuntimeRegistry · RemoteNativeEngine proxy  │
│  JavaScript: Rhino · Lua: LuaJ               │
│  pdb · streaming output · PTY (forkpty)      │
└──────────────────┬──────────────────────────┘
                   │ Messenger + JSON
┌──────────────────▼──────────────────────────┐
│  :engine process                             │
│  NativeEngine + pybridge.c (JNI)             │
│  libpython3.13.so · libpybridge.so           │
│  C extensions · assets/python-stdlib.zip     │
└─────────────────────────────────────────────┘
```

**Core trade-off**: no external native toolchain dependency, no cloud requirement. CPython 3.13 is cross-compiled with the NDK for both `arm64-v8a` and `x86_64`; JavaScript and Lua use pure-Java Rhino/LuaJ. Python runs in a dedicated `:engine` process, so a stuck native call can be killed without taking the editor down. The terminal has a real `forkpty` backend and a local xterm.js ANSI screen. Java/Kotlin/TypeScript plus 14 other languages are editing-only.

---

## 🎯 Features

### Write code
- **Multi-file tabs** · **file tree** (new / rename / delete, long-press actions)
- **Sora Editor** code editor + 20-language TextMate syntax highlighting (3 runnable, 17 editable)
- **Static completion**: per-language keyword/builtin profiles + symbols from the current file (zero process overhead)
- **Python go-to-definition**: cursor symbol → project-wide `class` / `def` / module variable, with import-aware ranking (no LSP process)
- **Find & replace** (count & jump) · **global search** (cross-file)
- **26-key symbol bar** · **pinch-to-zoom font size** · auto bracket closing · soft wrap · line number toggle
- **6 editor themes** (Darcula / Monokai / Tomorrow Night Blue / Solarized…)

### Run code
- **Python**: native CPython 3.13 (arm64 + x86_64), standard library (test/idlelib/turtledemo trimmed) + C extensions
- **JavaScript**: Rhino 1.7.15, pure Java, `console.log` / `input`
- **Lua**: LuaJ 3.0.1, pure Java, `print` / `input`
- **Streaming output** · **`input()` interaction** · arrow-key / Tab soft keyboard
- **Infinite-loop protection** (timeout interrupt) · foreground service keep-alive
- **Friendly error translations** (Python / JavaScript / Lua)
- Run configuration (command-line args) · standard Python script attributes like `__file__`

### Code intelligence & debugging (0.0.28)
- **Python go-to-definition**: cursor symbol → project-wide definitions, import-aware ranking, file/line/signature picker
- **Python pdb debugger**: real stdlib `pdb`; breakpoints, next/step/continue, `p locals()`, stack, quit; quick-action bar in output panel
- **Offline by design**: no language server process, no model download, hard caps at 300 `.py` files / 512KB per file

### Trusted mobile IDE foundation (0.1.0)
- **Python engine isolation**: Python runs in `android:process=":engine"`; the main process holds only a Messenger proxy. The output panel's **重启引擎** action kills and rebinds only the engine process, preserving unsaved editor buffers, Git and terminal state
- **Git review loop**: per-file stage / unstage, stage-all, commit-staged-only, and a diff dialog (working tree vs index, untracked files as all-added); 200KB output cap with bounded streaming so a 100MB log does not OOM
- **Bounded previews**: Markdown/HTML preview is capped at 512K characters with a visible banner; the editor buffer itself is untouched
- **File-tree truncation banner**: 10,000-node budget is no longer silent
- **Async encrypted settings**: sensitive fields (AI key, Git remote token, MCP endpoint) coalesce on a single background writer; `onStop`/`onCleared` flush the last version
- **Pure-Python package import**: `.whl` / `.zip` with `dist-info` metadata, native `.so/.pyd/.dll/.wasm` rejection, Zip-Slip guards, and reverse-order rollback on failure
- **Quality gate**: 171 JVM/Robolectric tests, `lintRelease` 0 errors, Compose smoke for file-tree truncation, Git diff and fontScale 2.0

### Project migration & process teardown (0.0.34)
- **Clone from Git**: `GitManager.cloneInto` uses JGit to clone an HTTPS remote into a new project; credentials go through `UsernamePasswordCredentialsProvider` and are never written into `.git/config`, and the target must be absent or empty
- **Project zip import/export**: stream-based zip import with Zip Slip / absolute path / Windows drive rejection, 10,000-entry, 48MB-per-file and 256MB-total caps; a single top-level folder is promoted to the project root; export skips `.git`, `build`, `node_modules` and caches and caps at 256MB
- **Async-signal-safe PTY child**: `ptybridge.c` now builds `argv`/`envp` before `forkpty`; the child only calls `chdir` + `execve`, with no `setenv` after fork
- **Command process groups**: `ProcessGroup` writes the shell PID to a temp file, enters a new session via `/system/bin/setsid`, and sends `SIGTERM`/`SIGKILL` to the negative PID; when `setsid` is absent it falls back to the old direct-child behavior
- **Engine-stuck escape hatch (historical)**: 0.0.34 detected a busy engine 8s after Stop and offered **重启应用**; 0.1.0 replaced this with true `:engine` process isolation and **重启引擎**

### Lifecycle & memory cleanup (0.0.33)
- **ViewModel teardown**: `onCleared` cancels AI/Agent/model jobs, stops the PTY, and releases the native Python engine + RuntimeRegistry instead of leaving them alive after the Activity is reclaimed
- **Streaming session metadata**: `AgentSessionStore.metaOf` reads a session log once line-by-line; listing 20 sessions no longer pulls multiple 16MB files into memory
- **Honest delete result**: project deletion now returns `deleteRecursively()`'s Boolean, so the UI no longer reports success when the filesystem refused
- **Bounded PTY input**: a 256-slot input queue and a 64KB per-write cap replace the unbounded channel; large pastes are truncated with a visible message

### Packaging cleanup (0.0.32)
- **Stale toolchain note removed**: the 441MB `usrtar.zip` instructions are gone; the app uses the bundled native CPython runtime and JGit, not the retired Termux bundle
- **Stdlib slimmed**: CPython `test`, `idlelib` and `turtledemo` are excluded from `python-stdlib.zip`; 1740 files / 7.1MB removed, all runtime modules and 53 C extensions untouched
- **Git wording fixed**: 0.0.32 aligned docs and site to init / commit / push / pull; 0.0.34 added HTTPS clone; 0.1.0 adds stage / unstage / stage-all / commit-staged / diff

### Data safety & lifecycle (0.0.31)
- **No silent data loss**: with auto-save off, switching files/tabs/projects now asks Save / Discard / Cancel instead of overwriting the dirty buffer
- **Atomic saves**: temp file + `fsync` + `rename` for editor files, workspace writes and Agent checkpoints; a crash leaves the old version, not half a file
- **Durable background save**: `onStop` writes synchronously, so a kill right after backgrounding cannot drop the latest snapshot
- **Bounded I/O**: 5MB editor files, 8MB checkpoint blobs, 32MB SAF imports, 16MB Agent session logs, 10k file-tree nodes, 2MB AI responses, 200KB share/clipboard text
- **Lifecycle cleanup**: Back closing the terminal stops the PTY; closing the Agent panel cancels the running Agent; renaming/deleting a directory migrates/removes its open tabs
- **Agent overwrite guard**: Agent edits and checkpoint restore never silently replace an unsaved editor buffer
- **Execution robustness**: foreground-service stop no longer relies on background `startService`; a partial wakelock keeps long scripts running with the screen off; PTY input is FIFO and JNI callback exceptions are cleared
- **Theme/IME polish**: status/navigation bar icon contrast follows the in-app theme; two-finger pinch no longer steals one-finger editor scrolling

### Mobile layout & keyboard (0.0.30)
- **No more clipped panels**: every dialog is edge-to-edge and sized to the area above the IME; title, footer input and action buttons stay fixed while only the body scrolls
- **Terminal resizes with the keyboard**: PTY body uses the remaining height, so Esc/Tab/Ctrl/arrow keys stay visible instead of being pushed under the soft keyboard
- **Stable orientation**: screen mode follows the system orientation, not the content height, so opening the keyboard no longer flips a portrait phone into the landscape layout
- **Output height remembers you**: keyboard-only clamping is temporary; the preferred draggable height is not overwritten, and the stdin row keeps 220dp when space allows and yields to 150dp on very short screens
- **Small-screen polish**: one-line ellipsis for title/status, scrollable status text, capped tab width, and scrollable quick-action/special-key rows

### Agent & terminal (0.0.29)
- **Agent plan mode**: plan → approval → tool execution, with cross-turn context and token budgets
- **Project rules**: reads `AGENTS.md` / `CLAUDE.md` / `.cursorrules` / `.windsurfrules` / Copilot instructions
- **Read-only sub-agent**: `delegate_task` explores multiple files in an isolated context
- **Offline semantic search**: TF-IDF index with file/line hits, no embedding download
- **Command terminal panel**: persistent cwd, `cd`/`pwd`, timeout and output caps; PTY mode switches to xterm with mobile Esc/Tab/Ctrl/arrow keys and light/dark themes
- **Real ANSI terminal**: `forkpty` + `/system/bin/sh -i` feeding a local xterm.js 5.5.0 screen; cursor addressing, 256-color SGR, alternate screen and scrollback work, with `vim` / `top` / `less`; resize is wired to `TIOCSWINSZ`
- **MCP tools/resources/prompts**, retrying providers, persisted AI history

### Manage projects
- **Multi-project switching** (long-press to delete) · **4 Python templates**
- **JGit Git integration**: init / commit / push / pull / clone (HTTPS), pure Java, offline where possible
- **SAF import/export** (no storage permission needed): project zip in/out with traversal and size guards
- **Offline package management**: inspect built-in modules / import pure-Python `.whl` or `.zip`; native wheels are rejected before writing

### See results
- **Markdown / HTML split-pane live preview**, debounced refresh
- **Open HTML files in external browser**
- **Output panel**: draggable height / copy all / share
- **3-mode theme** (follow system / light / dark)

### Be productive
- **Command palette ⌘K**: search every action + code snippets
- **AI assistant** (BYOK, OpenAI-compatible endpoint): explain files / fix errors / generate tests
- **Session restore**: return to your last editing session on restart
- **Crash logs** written to private storage, offline-friendly feedback

---

## 🚀 Quick Start

```bash
# 1) Prerequisites: JDK 17+, Android SDK (platforms;android-35, build-tools;34.0.0)
#    local.properties: sdk.dir=/path/to/android-sdk

# 2) Build the APK directly after cloning
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk

# 3) Open the app → create a project → write code → tap ▶ Run
```

The native runtime (`libpython3.13.so` + C extensions + pure-Python stdlib zip, ~100MB) is already in the repo, so **the app runs fully offline after build**.

> Rebuilding `libpybridge.so` requires the NDK 27.3 toolchain and a CPython 3.13 cross-compile environment — see `scripts/package_native.sh`. Not needed for daily builds: prebuilt artifacts are already in `app/src/main/jniLibs/`.

> `assets/python-stdlib.zip` must keep `noCompress` enabled (already configured); otherwise AAPT compression breaks CPython's stdlib loading.

---

## 📦 Bundled Runtime

- **Pure-Python stdlib**: `assets/python-stdlib.zip` (extracted to the app's private dir, then added to `sys.path`)
- **C extension modules**: math, json, _random, _datetime, _socket, _ssl, _sqlite3, _ctypes, zlib, binascii etc. (`jniLibs/arm64-v8a` / `x86_64`)
- **numpy / pandas / matplotlib / pillow are NOT preinstalled** — `import numpy` shows a missing-module hint. Pure-Python wheels can be imported offline; wheels containing Android-native `.so` files are rejected because the bundled CPython does not ship their ABI dependencies.

---

## 📚 Documentation

| Doc | About | Language |
|---|---|---|
| [Branding](docs/BRANDING.md) | Naming, positioning, slogan, visual guidelines | 中文 |
| [Introduction](docs/INTRODUCTION.md) | One-page project intro for website / promotion | 中文 |
| [User Guide](docs/USER_GUIDE.md) | Install, UI, run, Git, AI — full manual | 中文 |
| [Architecture](docs/ARCHITECTURE.md) | Engine, JNI bridge, threading model, layout | 中文 |
| [Roadmap](docs/ROADMAP.md) | Done / in progress / planned | 中文 |
| [Promotion Pack](docs/PROMOTION.md) | Store description, release notes, social copy | 中文 |
| [FAQ](docs/FAQ.md) | Frequently asked questions | 中文 |
| [Contributing](CONTRIBUTING.md) | How to get involved | English |
| [Code of Conduct](CODE_OF_CONDUCT.md) | Contributor Covenant | English |
| [Security](SECURITY.md) | Vulnerability reporting | English |

---

## 🧭 Capability Boundaries (honest notes)

| Capability | Status |
|---|---|
| Python runtime | ✅ Full (native CPython 3.13, arm64 + x86_64) |
| Java runtime | ❌ JVM not yet integrated (editing/highlighting only) |
| Performance | ✅ Native execution, no WASM sandbox overhead |
| Sci-stack libraries | ⚠️ numpy/pandas/matplotlib not preinstalled; pure-Python wheels only |
| pip online install | ❌ Offline-first; extra pure-Python libraries via manual `.whl`/`.zip` import |
| Gradle/Java/Kotlin build | ❌ Not in 0.1.0; no JVM/Gradle toolchain bundled |
| Full LSP | ❌ Symbol index + static completion, not a language server |

---

## 🤝 Contributing

All contributions are welcome: file issues, improve docs, fix bugs, add features.

Run `python3 tools/selfcheck.py` before submitting (0 errors), see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

[Apache License 2.0](LICENSE) · third-party component notices in [NOTICE.md](NOTICE.md)

---

*CodePocket「口袋码」— keep your IDE in your pocket, code offline anywhere.*
