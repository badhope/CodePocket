# DocForge

> 断网也能用的开发者工具箱。20 个浏览器工具、多语言代码沙盒、文档格式转换——全部跑在你的浏览器里，后端挂了也不影响。接上后端后解锁账户、协作编辑、高保真 DOCX/PDF/XLSX 输出。

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-dc382d?logo=redis)](https://redis.io)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-c5f74f)](https://orm.drizzle.team)
[![Tests](https://img.shields.io/badge/vitest-52%20unit-6e9f18?logo=vitest)](./src/lib)
[![Audit](https://img.shields.io/badge/pnpm%20audit-0%20CVE-success)]()

---

## 这是什么？

DocForge 是一个**离线优先**的开发者工具平台。它不是那种"必须连服务器才能干活"的 SaaS——核心功能全部在浏览器端完成，后端只是锦上添花。

你能用它做什么：

- **20 个开发者工具** — JSON/CSS/SQL/HTML 格式化、YAML⇄JSON、TOML⇄JSON、CSV⇄JSON、Markdown⇄HTML、Base64/URL 编解码、SHA 哈希、JWT 解码、UUID 生成、颜色转换、进制转换、Lorem ipsum、QR 码、Cron 解析、正则测试、文本 Diff。全部离线可用，打开浏览器就能跑。
- **多语言代码沙盒** — Python 3（Pyodide）、JavaScript/TypeScript（Web Worker）、Lua（fengari）、SQL（sql.js）直接在浏览器里执行。接上后端后还能跑 C/C++、Go、Rust、Java、Ruby、PHP、Perl、Swift 等 14 种语言。
- **文档格式转换** — DOCX ⇄ PDF ⇄ Markdown ⇄ HTML ⇄ XLSX ⇄ CSV ⇄ JSON ⇄ XML ⇄ PPTX。浏览器端能做基础转换，后端加持后输出高保真排版。

## 30 秒上手

```bash
# 克隆
git clone https://github.com/badhope/OnlineCode.git
cd OnlineCode

# 安装依赖
pnpm install

# 启动开发服务器（不需要后端，工具直接能用）
pnpm dev          # → http://localhost:3000
```

打开浏览器，访问 `/en/tools`，20 个工具全部可用。不需要数据库，不需要 Redis，不需要任何后端服务。

## 想要完整功能？

如果你需要账户系统、协作编辑、高保真文档输出，启动后端依赖：

```bash
make up           # 启动 Postgres 16 + Redis 7 + Piston-shim
make dev          # 启动开发服务器
```

`make up` 会自动：
- 启动 Postgres 集群（端口 5432）
- 启动 Redis（端口 6379）
- 启动本地 Piston-shim 代码执行服务（端口 2000）
- 创建数据库并应用迁移

### Piston-shim 是什么？

公共 Piston API（`emkc.org`）从 2026 年 2 月起只允许白名单访问，未认证请求直接 401。所以我们写了一个兼容的本地替代品，200 行 Node.js 代码，复用你系统上已有的编译器和运行时：

```bash
make piston-up      # 启动（幂等，有 pidfile 保护）
make piston-down    # 停止
make piston-status  # 查看状态和支持的语言
make piston-logs    # 查看日志
```

支持 14 种语言：Python 3.14、Node 24、TypeScript、C/C++ 13、Go 1.25、Rust、Java 25、Ruby 3.4、PHP、Perl、Swift 6、SQLite、Bash。

生产环境建议用 [engineer-man/piston](https://github.com/engineer-man/piston) 的 Docker 镜像获得 cgroup/seccomp 隔离。

## 20 个工具一览

全部在 `/[locale]/tools` 下，**完全离线**，零网络请求。

| 分类 | 工具 |
|------|------|
| **格式化** | JSON 格式化、CSS 格式化、SQL 格式化、HTML 格式化 |
| **转换** | YAML⇄JSON、TOML⇄JSON、CSV⇄JSON、Markdown⇄HTML |
| **编解码** | Base64、URL 编码、SHA 哈希、JWT 解码 |
| **生成** | UUID、颜色（HEX/RGB/HSL）、进制转换、Lorem ipsum、QR 码 |
| **解析** | Cron 表达式、正则测试、文本 Diff |

每个工具都通过离线优先状态机（`useBackendStatus` + feature gate）运行。后端在线时走 API，离线时自动降级到浏览器端——不会假装成功，状态一目了然。

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js 16 (App Router)                       │
│                                                                   │
│   页面层        src/app/[locale]/**   — 多语言页面               │
│   接口层        src/app/api/**        — 路由处理器               │
│   离线引擎      src/lib/system/       — 状态机 + feature gate    │
│   工具集        src/lib/tools/        — 20 个浏览器端工具        │
│   执行器        src/lib/execution/    — Piston 客户端 + WASM     │
│   协作层        src/lib/collab/       — Yjs / Monaco 绑定        │
│                                                                   │
│   feature gate ──►  本地功能 → 浏览器端执行                      │
│                    远程功能 → /api/* → Piston-shim               │
└──────────┬──────────────────────────────────────┬───────────────┘
           │                                      │
  可选 ▼                                   可选 ▼
  ┌──────────────┐                    ┌──────────────────┐
  │ PostgreSQL 16 │                    │  Piston-shim     │
  │ (Drizzle ORM) │                    │  127.0.0.1:2000  │
  └──────────────┘                    └──────────────────┘
           │                                      │
           └──────────►  Redis 7  ◄───────────────┘
                        (滑动窗口限流)
```

### 离线优先状态机

每个页面都订阅 `useBackendStatus()` 这个 hook，底层是 `useSyncExternalStore`。状态流转：

```
unknown → checking → online  → degraded
                    online  ← ┘
                    online  → offline
                    offline → online（重新检测）
```

`feature-gate` 模块把每个功能标记为 `"local"`（浏览器端）或 `"remote"`（需要 API）。`"local"` 功能永远可用，`"remote"` 功能诚实报告降级状态——没有"假装成功"的路径。

## 怎么扩展

### 加一个新的浏览器端工具

1. 在 `src/lib/tools/client-tools.ts` 里加一个函数，签名为 `(input: string, options?: Record<string, string>) => Promise<string>`
2. 在 `src/lib/system/feature-gate.ts` 的 `LOCAL_FEATURES` 数组里注册
3. 在 `src/messages/*.json` 里加工具名和描述的 i18n 条目
4. 在 `/[locale]/tools/[slug]` 路由下自动可用

### 加一种新的执行语言

1. 在 `src/lib/execution/languages.ts` 里加语言定义
2. 如果是浏览器端执行，在 `src/lib/execution/frontend-runner.ts` 里加 runner
3. 如果是后端执行，Piston-shim 会自动发现系统上已安装的工具链

### 加一种新的文档格式

1. 在 `src/lib/convert/` 下加转换模块
2. 在 `src/lib/convert/formats.ts` 里注册格式对
3. 在 `src/lib/convert/engine.ts` 里接入转换管线

### 加一种新的语言翻译

1. 复制 `src/messages/en.json` 为新语言文件（如 `de.json`）
2. 翻译所有条目
3. 在 `src/lib/i18n/routing.ts` 的 `locales` 数组里加语言代码

## Make 命令速查

| 命令 | 作用 |
|------|------|
| `make up` | 启动 Postgres + Redis + Piston-shim，应用迁移 |
| `make down` | 停止所有后端服务 |
| `make status` | 查看各服务状态 |
| `make dev` | 启动 Next.js 开发服务器 |
| `make build` | 生产构建 |
| `make test` | 运行单元测试 |
| `make lint` | ESLint 检查 |
| `make typecheck` | TypeScript 类型检查 |
| `make smoke` | 端到端冒烟测试 |
| `make db-reset` | 重置本地数据库（破坏性） |
| `make db-studio` | 打开 Drizzle Studio |
| `make bootstrap` | 首次设置：创建角色/数据库 + 迁移 + 安装依赖 |

## 环境变量

所有配置都在 `.env` 文件里，完整注释见 [`.env.example`](./.env.example)。关键变量：

| 变量 | 用途 |
|------|------|
| `NEXT_PUBLIC_STATIC_DEMO` | `1` = 纯前端模式（gh-pages 构建默认值） |
| `NEXT_PUBLIC_COLLAB_URL` | Yjs WebSocket 地址；不设 = 单人模式 |
| `POSTGRES_URL` | 数据库连接串 |
| `AUTH_SECRET` | NextAuth v5 密钥（32+ 字符） |
| `AUTH_URL` | 应用 URL |
| `AUTH_GITHUB_ID/SECRET` | GitHub OAuth（可选） |
| `UPSTASH_REDIS_REST_*` | Upstash Redis（生产环境） |
| `RATE_LIMIT_*` | 限流配置 |
| `PISTON_API_URL` | Piston-shim 地址，默认 `http://127.0.0.1:2000/api/v2` |
| `SENTRY_DSN` | 错误上报（可选） |

## 项目结构

```
src/
├── app/
│   ├── [locale]/             # 多语言页面
│   │   ├── convert/          # 文档转换
│   │   ├── tools/            # 20 个离线工具
│   │   ├── playground/       # 代码沙盒
│   │   ├── projects/         # 项目管理
│   │   ├── snippets/         # 代码片段
│   │   ├── dashboard/        # 用户面板
│   │   ├── settings/         # 账户设置
│   │   ├── offline/          # 后端状态页
│   │   ├── docs/             # 文档
│   │   └── sign-in|sign-up/  # 登录/注册
│   └── api/                  # 路由处理器
├── lib/
│   ├── system/               # 离线优先状态机 + feature gate
│   ├── tools/                # 20 个浏览器端工具
│   ├── execution/            # 代码执行引擎
│   ├── convert/              # 文档转换引擎
│   ├── collab/               # Yjs/Monaco 协作
│   ├── auth/                 # NextAuth 配置
│   ├── db/                   # Drizzle 数据库
│   ├── i18n/                 # 国际化
│   ├── storage/              # Redis 抽象
│   ├── validators/           # Zod 校验
│   └── api/                  # CORS、日志、限流
├── components/               # UI 组件
├── messages/                 # 多语言文件（en/zh-CN/ja/ko/es/fr）
└── stores/                   # 状态管理
```

## Monorepo 里的其他包

```
OnlineCode/
├── (主应用 — Next.js 16)
├── infra/
│   ├── piston-shim/        # Piston 兼容的代码执行 API（Node.js，200 行）
│   └── collab-server/      # Yjs/Hocuspocus WebSocket 协作服务器
└── miniprogram/            # Taro 微信小程序（共用后端 API）
```

| 命令 | 作用 |
|------|------|
| `pnpm mp:dev` | 小程序开发模式 |
| `pnpm mp:build` | 小程序构建 |
| `make piston-up` | 启动本地 Piston-shim |

## 测试

```bash
make test       # vitest（52 个单元测试）
make lint       # ESLint（0 errors, 0 warnings）
make typecheck  # tsc --noEmit（0 errors）
```

E2E 测试（Playwright）已搭建框架，尚未接入 CI：

```bash
pnpm test:e2e
```

安全审计：所有传递依赖零 CVE（`pnpm audit` 通过），强制升级的版本见 `package.json` 的 `pnpm.overrides`。

## 部署

两种部署模式：

**完整栈（带后端）** — `NEXT_PUBLIC_STATIC_DEMO=0`，需要 Postgres、Redis、Piston-shim。账户、协作、高保真文档输出全部启用。支持 Vercel、Render、Fly.io 或任何容器平台。

**纯静态（浏览器端）** — `pnpm build:gh-pages` 生成自包含静态站点，部署 `out/` 目录到 GitHub Pages、Cloudflare Pages 或任何静态托管。20 个工具和代码沙盒全部可用，无需后端。协作服务器可独立部署。

生产环境建议：
- 用 Upstash Redis 替代本地 Redis
- 用托管 Postgres（Neon、Supabase、RDS）
- 可选 Vercel Blob 上传、Sentry 错误上报

## License

MIT
