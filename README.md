# 🚀 OnlineCode

[English](#english) | [中文](#chinese)

> **2026 cross-platform online code editor & compiler** — Open the browser, write code, hit Run.
> No installation. No setup. Pure web (PWA) + 19 languages via Piston.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss)](https://tailwindcss.com)
[![Drizzle](https://img.shields.io/badge/Drizzle-0.45-c5f74f?logo=drizzle)](https://orm.drizzle.team)
[![NextAuth](https://img.shields.io/badge/NextAuth-v5-7928ca)](https://authjs.dev)
[![PWA](https://img.shields.io/badge/PWA-enabled-5a0fc8)](https://web.dev/progressive-web-apps)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![CI](https://github.com/badhope/OnlineCode/actions/workflows/ci.yml/badge.svg)](https://github.com/badhope/OnlineCode/actions/workflows/ci.yml)

---

<a id="english"></a>
## 📖 English

### What is OnlineCode?

OnlineCode is an **instant online coding environment**. You can write and execute code in 19 programming languages without creating an account, installing anything, or setting up a project. Think of it as a Replit / CodeSandbox that's free, self-hostable, and fully open-source.

### 🎯 When to use it?

| Scenario | How OnlineCode helps |
|----------|---------------------|
| **Quick testing** | Open Playground → write code → run. Zero friction. |
| **Teaching / tutorials** | Share code via URL link; students open & run instantly. |
| **Interviews** | Share a live coding environment with candidates. |
| **Full projects** | Sign up → create project → multi-file editing + version history. |
| **Self-hosted sandbox** | Deploy your own Piston + collab server for private execution. |

### ✨ Features

- 🎮 **Instant Playground** — No login required. Pick a language, type code, click Run. Output appears below. Supports 6 ecosystems (pip / npm / cargo / go / maven / gem).
- 🌐 **19 languages** — Python, JavaScript, TypeScript, C, C++, Rust, Go, Java, C#, PHP, Ruby, Kotlin, Swift, Scala, Bash, Lua, SQL, HTML, CSS.
- 📁 **Projects** — Create multi-file projects with file tree, tabbed editing, auto-save, and version history. Each project gets its own package manager.
- 📦 **Package Manager** — Browse and install packages for Python (pip), Node (npm), Rust (cargo), Go, Java (maven), and Ruby (gem) directly inside your projects.
- 🔐 **Auth** — Email/password + GitHub OAuth + Google OAuth. JWT sessions, rate limiting, bcrypt(12) hashing.
- 👥 **Collaboration** — Real-time collaborative editing via Yjs CRDT. Optional self-hosted Hocuspocus server included.
- 🔗 **Sharing** — Create password-protected share links with optional burn-after-read. QR code generation.
- 🌍 **6 locales** — English, 中文, 日本語, 한국어, Español, Français (345 translation keys, all complete).
- 🎨 **UI** — shadcn/ui (New York style), Light/Dark/System themes, fully responsive.
- 📱 **PWA** — Installable on desktop and mobile. Works offline with service worker.
- 🛡️ **Security** — Rate limiting, CSP headers, HSTS, CORS, input validation.

### 🧭 User Guide — Navigating the App

#### 🎮 Playground (no login needed)

Go to `/playground` (or click "Playground" in the nav). You'll see:

```
┌──────────────────────────────────────────────────┐
│  [Python ▼] [3.10.0 ▼]    [▶ Run] [🗑] [📋] [🔗] [💾] │ ← Toolbar
├────────────────────┬─────────────────────────────┤
│  main.py ×         │  [Templates] [Packages]      │ ← Side panel
│  ┌──────────────┐  │  ┌───────────────────────┐  │
│  │ print("hi")  │  │  │ ◻ Hello World         │  │
│  │              │  │  │ ◻ Fibonacci            │  │
│  │              │  │  │ ◻ Prime Check          │  │
│  └──────────────┘  │  └───────────────────────┘  │
├────────────────────┴─────────────────────────────┤
│  Output                                           │
│  > Python 3.10.0                                  │
│  hi                                               │
│  ✓ Execution completed (0.12s)                    │
│                                                   │
│  Standard Input: [  enter input here...       ]   │
└──────────────────────────────────────────────────┘
```

**Steps:**
1. Pick a language from the dropdown (left side of top toolbar).
2. Write or paste code in the editor.
3. Click the green **Run** button.
4. Output appears below. Use **Standard Input** box to send data to your program.
5. Click **Templates** (right panel) to load pre-written examples.
6. Click **Packages** (right panel) to add dependencies (e.g. `numpy` for Python, `lodash` for Node).
7. Use the **Share** button to copy a URL that encodes your code — anyone can open it.

**Multi-file:** Click **+ File** to add more files. All files are sent to Piston together—great for C/C++ header files or multi-module Python.

**Keyboard:** `Ctrl+Enter` to run (Monaco shortcuts also work for editing).

---

#### 📁 Projects (login required)

Go to `/projects` → click **New Project**.

1. Name your project and choose the main language.
2. You'll enter the full project editor:
   - **Left sidebar**: File tree. Right-click or use buttons to create/rename/delete files.
   - **Center**: Tabbed code editor (Monaco, same as VS Code).
   - **Bottom**: Console output, Graphics canvas, 3D scene, or Packages panel.
3. Click the package icon tab to install dependencies.
4. Changes are auto-saved after 800ms of inactivity. Manual save with `Ctrl+S`.

**Sharing a project:** Click the share icon (top toolbar) → choose visibility (public / password / burn-after-read) → set expiry → copy link.

---

#### 📝 Snippets (login required)

Go to `/snippets` → **New Snippet**. Snippets are single-file, tagged code blocks. Useful for storing reusable algorithms, configuration examples, or sharing quick code on social media.

---

#### 🔗 Sharing (no login for viewing)

Anyone with a share link can view the shared project or snippet:
- **Public**: Open URL → see the code.
- **Password**: Open URL → enter password → see the code.
- **Burn after read**: Open URL once → content is permanently destroyed.

Share links can also be embedded with an iframe code (coming soon).

---

### 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2 (App Router) + React 19.2 + Turbopack |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| State | Zustand 5 + TanStack Query 5 |
| Database | Vercel Postgres (Neon) + Drizzle ORM (15 tables) |
| Auth | NextAuth v5 (Auth.js) with Drizzle adapter |
| Cache | Upstash Redis (rate limiting + session) |
| Storage | Vercel Blob (user uploads) |
| Editor | Monaco Editor (VS Code engine) |
| Terminal | xterm.js |
| 3D | Three.js + React Three Fiber |
| i18n | next-intl (6 locales, 345 keys) |
| Execution | Piston API (self-hostable) |
| Collab | Yjs + Hocuspocus |
| Monitoring | Sentry |
| Testing | Vitest (26 tests) + Playwright (5 E2E tests) |
| CI/CD | GitHub Actions + Vercel |

---

### 🏃 Quick Start

```bash
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set AUTH_SECRET (openssl rand -base64 32)

# 3. Start development server
pnpm dev
# Open http://localhost:3000

# 4. Run tests
pnpm test           # Vitest unit tests (26 passing)
pnpm test:e2e       # Playwright E2E tests (5 passing)

# 5. Build for production
pnpm build
pnpm start
```

### 🔐 Environment Variables

See `.env.example` for the complete list. Minimum required:

```bash
# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database (Vercel Postgres / Neon)
POSTGRES_URL="postgres://user:pass@host:5432/db"

# Auth
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="http://localhost:3000"

# Execution (uses free public API if not set)
# PISTON_API_URL="https://emkc.org/api/v2/piston"
```

For full functionality (Redis caching, OAuth, Sentry, Blob storage), fill in the optional variables in `.env.example`.

### 🚀 Deployment

#### Vercel (recommended)
1. Push to GitHub.
2. Import repo in Vercel.
3. Add environment variables.
4. Deploy. The included `vercel.json` configures regions, cron jobs, and security headers automatically.

#### Self-hosted Piston (execution backend)
```bash
git clone https://github.com/engineer-man/piston
cd piston
docker compose up
# Piston API now at http://localhost:2000/api/v2
# Set PISTON_API_URL=http://localhost:2000/api/v2 in your .env
```

#### Self-hosted Collaboration server
```bash
cd infra/collab-server
docker compose up
# Set NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234 in your .env
```
See `infra/collab-server/README.md` for Fly.io deployment instructions.

### 📁 Project Structure

```
OnlineCode/
├── src/
│   ├── app/
│   │   ├── [locale]/              # 18 localized pages (6 locales × all routes)
│   │   └── api/                   # 19 REST API endpoints
│   ├── components/
│   │   ├── ui/                    # 25 shadcn/ui primitives
│   │   ├── editor/                # CodeEditor, Playground v2, Terminal, 3D
│   │   ├── project/               # ProjectEditor, FileTree, PackageManager
│   │   ├── collab/                # CollabPresence (Yjs awareness)
│   │   ├── share/                 # ShareDialog (QR + password + burn)
│   │   └── layout/                # Header, ThemeToggle, LanguageSwitcher, UserMenu
│   ├── lib/
│   │   ├── auth/                  # NextAuth config + Drizzle adapter
│   │   ├── db/                    # Drizzle schema (15 tables) + connection pool
│   │   ├── execution/             # Piston API client + 19 language definitions
│   │   ├── storage/               # Redis client + Vercel Blob wrapper
│   │   ├── collab/                # useYCollab hook + useYMonacoBinding
│   │   ├── validators/            # Zod schemas (auth, project, file, snippet, execute)
│   │   ├── i18n/                  # next-intl routing + navigation
│   │   ├── packages/              # 6 ecosystem configs + manifest generation
│   │   └── utils/                 # cn, debounce, throttle, slugify, formatBytes...
│   ├── messages/                  # 6 locale JSON files (345 keys each)
│   └── stores/                    # Zustand editor store (persisted to localStorage)
├── public/                        # Static assets + manifest.json + sw.js
├── drizzle/                       # Auto-generated SQL migrations
├── tests/
│   ├── unit/                      # 26 tests: utils, languages, validators
│   └── e2e/                       # 5 tests: home, locales, sign-in, playground, offline
├── infra/
│   ├── collab-server/             # Docker + docker-compose + Fly.io + server.mjs
│   └── piston/                    # Docker + docker-compose + Fly.io for Piston
├── scripts/seed.ts                # Database seeding
├── .github/workflows/             # CI (lint → typecheck → test → build) + Vercel preview
├── vercel.json                    # Vercel config (regions, crons, headers)
├── .env.example                   # Environment template (all vars documented)
└── LICENSE                        # MIT
```

### 🧑‍💻 Development Scripts

| Script | What it does |
|--------|-------------|
| `pnpm dev` | Start dev server on :3000 (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint check (0 errors, 0 warnings) |
| `pnpm lint:fix` | ESLint auto-fix |
| `pnpm format` | Prettier format all files |
| `pnpm format:check` | Prettier check (CI) |
| `pnpm typecheck` | `tsc --noEmit` (CI) |
| `pnpm test` | Vitest unit tests |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:coverage` | Vitest with coverage report |
| `pnpm test:e2e` | Playwright E2E (5 browser projects) |
| `pnpm test:e2e:ui` | Playwright with UI mode |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Run migrations against DB |
| `pnpm db:push` | Push schema directly (dev) |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:seed` | Seed database |

### 🤝 Contributing

1. Fork the repo.
2. Create a feature branch: `git checkout -b feat/my-feature`.
3. Make changes. Run `pnpm lint && pnpm typecheck && pnpm test` before committing.
4. Commit with clear messages.
5. Push and open a Pull Request.

CI will automatically run lint → typecheck → test → build. All checks must pass.

### 📜 License

MIT — see [LICENSE](LICENSE).

---

<a id="chinese"></a>
## 📖 中文

### OnlineCode 是什么？

OnlineCode 是一个**即时在线编程环境**。无需注册账号、无需安装任何东西、无需创建项目，就可以直接编写和运行 19 种编程语言的代码。你可以把它想象成一个免费、可自托管、完全开源的 Replit / CodeSandbox。

### 🎯 什么时候用它？

| 场景 | OnlineCode 如何帮你 |
|------|-------------------|
| **快速测试代码** | 打开 Playground → 写代码 → 点运行。零摩擦。 |
| **教学/教程** | 通过 URL 链接分享代码；学生打开就能运行。 |
| **面试** | 分享一个实时代码环境给候选人。 |
| **完整项目** | 注册 → 创建项目 → 多文件编辑 + 版本历史。 |
| **自托管沙箱** | 部署你自己的 Piston + 协作服务器，实现私密执行。 |

### ✨ 功能特性

- 🎮 **即时 Playground** — 无需登录。选语言、写代码、点运行。下方即时显示输出。支持 6 种包生态（pip / npm / cargo / go / maven / gem）。
- 🌐 **19 种语言** — Python、JavaScript、TypeScript、C、C++、Rust、Go、Java、C#、PHP、Ruby、Kotlin、Swift、Scala、Bash、Lua、SQL、HTML、CSS。
- 📁 **项目管理** — 创建多文件项目，支持文件树、标签页编辑、自动保存和版本历史。每个项目自带包管理器。
- 📦 **包管理器** — 在项目中直接浏览和安装包（Python pip、Node npm、Rust cargo、Go、Java maven、Ruby gem）。
- 🔐 **认证系统** — 邮箱/密码 + GitHub OAuth + Google OAuth。JWT 会话、速率限制、bcrypt(12) 加密。
- 👥 **协作编辑** — 基于 Yjs CRDT 的实时协作编辑。可选的自托管 Hocuspocus 服务器已包含。
- 🔗 **分享** — 创建带密码保护的分享链接，支持阅后即焚。二维码生成。
- 🌍 **6 种语言** — English、中文、日本語、한국어、Español、Français（345 个翻译键，全部完整）。
- 🎨 **界面** — shadcn/ui（New York 风格），浅色/深色/跟随系统，完全响应式。
- 📱 **PWA** — 可安装到桌面和手机。通过 Service Worker 离线工作。
- 🛡️ **安全** — 速率限制、CSP 头、HSTS、CORS、输入校验。

### 🧭 使用指南

#### 🎮 Playground（无需登录）

访问 `/playground`（或点击导航栏中的"演练场"）。你将看到：

- **顶部工具栏**：语言选择、运行/停止、清空输出、复制代码、分享、保存到本地。
- **左侧**：代码编辑器（Monaco，同 VS Code）。支持多文件（点击 "+ 文件" 添加）。
- **右侧面板**：
  - **模板 Tab**：点击加载预设代码示例（Hello World、算法等）。
  - **包管理 Tab**：添加依赖包（如 numpy、lodash），运行前会自动显示安装命令。
- **底部**：输出面板 + stdin 标准输入框。

**使用步骤：**
1. 左上角选择语言（Python / JavaScript / Rust / Go …）
2. 在编辑器中写代码
3. 点击绿色 **Run** 按钮
4. 输出显示在下方
5. 点击 **分享** 按钮复制链接，将代码编码到 URL 中

#### 📁 项目（需登录）

访问 `/projects` → 点击**新建项目**。进入项目编辑器后：
- **左侧**：文件树，创建/重命名/删除文件
- **中间**：标签页代码编辑器
- **底部**：控制台输出 / 图形 / 3D / 包管理
- 更改会自动保存，手动保存按 `Ctrl+S`

#### 📝 代码片段（需登录）

访问 `/snippets`。用于存储可复用的算法、配置示例等单文件代码块。

#### 🔗 分享

任何人拿到分享链接即可查看：
- **公开**：打开即看
- **密码保护**：需输入密码
- **阅后即焚**：首次查看后自动销毁

### 🏃 快速开始

```bash
pnpm install --frozen-lockfile
cp .env.example .env     # 编辑 .env 填入配置
pnpm dev                 # http://localhost:3000
pnpm test                # 26 项单元测试
pnpm test:e2e            # 5 项 E2E 测试
pnpm build               # 生产构建
```

### 💻 开发脚本

| 命令 | 作用 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 生产构建 |
| `pnpm lint` | ESLint 检查 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test` | 单元测试 |
| `pnpm test:e2e` | E2E 测试 |
| `pnpm db:generate` | 生成数据库迁移 |
| `pnpm db:studio` | 数据库管理界面 |

### 🚀 部署

1. 推送到 GitHub
2. 在 Vercel 中导入仓库
3. 添加环境变量
4. 部署 — `vercel.json` 已自动配置区域、定时任务和安全头

### 📜 许可证

MIT — 详见 [LICENSE](LICENSE)。
