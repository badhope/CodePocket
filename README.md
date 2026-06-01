# 🚀 OnlineCode

> 2026 cross-platform online code editor and compiler
> Pure web (PWA) + Vercel hosted + 19+ languages via Piston

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)](https://tailwindcss.com)
[![Drizzle](https://img.shields.io/badge/Drizzle-0.45-c5f74f)](https://orm.drizzle.team)
[![NextAuth](https://img.shields.io/badge/NextAuth-v5-purple)](https://authjs.dev)
[![PWA](https://img.shields.io/badge/PWA-enabled-green)](https://web.dev/progressive-web-apps)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/badhope/OnlineCode/actions/workflows/ci.yml/badge.svg)](https://github.com/badhope/OnlineCode/actions/workflows/ci.yml)

## ✨ Features

- 🌐 **19 languages**: Python, JavaScript, TypeScript, C, C++, Rust, Go, Java, C#, PHP, Ruby, Kotlin, Swift, Scala, Bash, Lua, SQL, HTML, CSS
- ⚡ **Piston execution**: Secure code execution via Piston API (self-hostable)
- 📁 **Multi-file projects**: File tree, tabbed editing, auto-save, version history
- 🔐 **Full auth**: Email/password, GitHub & Google OAuth, JWT sessions, rate limiting
- 👥 **Collaboration-ready**: Yjs CRDT infrastructure with Hocuspocus server
- 🌍 **6 locales**: English, 中文, 日本語, 한국어, Español, Français
- 🎨 **Themes**: Light/Dark/System with shadcn/ui (New York)
- 📦 **Storage**: Vercel Blob + Vercel Postgres (Neon) + Upstash Redis
- 🛡️ **Security**: Rate limiting, CORS, CSP, HSTS, bcrypt(12)
- 📱 **PWA**: Installable, offline-capable with service worker
- 📦 **Package Manager**: pip, npm, cargo, go modules support
- 🔗 **Sharing**: Password-protected links, burn-after-read, QR codes
- 🔭 **Observability**: Sentry error tracking, structured logs
- 🧪 **Tests**: 26 Vitest unit tests + 5 Playwright E2E tests (all passing)
- 🚀 **CI/CD**: GitHub Actions (lint, typecheck, test, build) + Vercel deploy

## 🛠️ Tech Stack

- **Framework**: Next.js 16.2 (App Router) + React 19.2 + Turbopack
- **Language**: TypeScript 5.9
- **Styling**: Tailwind CSS 4 + shadcn/ui (new-york)
- **State**: Zustand 5 + TanStack Query 5
- **DB**: Vercel Postgres (Neon) + Drizzle ORM
- **Auth**: NextAuth v5 (Auth.js) with Drizzle adapter
- **Cache/Queue**: Upstash Redis
- **Storage**: Vercel Blob
- **Editor**: Monaco Editor (VS Code)
- **Terminal**: xterm.js
- **3D**: Three.js + React Three Fiber
- **i18n**: next-intl
- **Execution**: Piston API (self-hostable)
- **Observability**: Sentry
- **Testing**: Vitest + Playwright
- **CI/CD**: GitHub Actions + Vercel

## 🏃 Quick Start

```bash
# Install
pnpm install --frozen-lockfile

# Copy environment template
cp .env.example .env
# Edit .env with your secrets

# Generate DB migrations
pnpm db:generate
pnpm db:migrate

# Dev
pnpm dev          # http://localhost:3000

# Build
pnpm build

# Test
pnpm test
pnpm test:e2e

# Lint + format
pnpm lint
pnpm format
```

## 📁 Project Structure

```
OnlineCode/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── [locale]/         # Localized routes
│   │   │   ├── dashboard/
│   │   │   ├── docs/         # Documentation
│   │   │   ├── playground/   # Code playground
│   │   │   ├── pricing/      # Pricing page
│   │   │   ├── projects/     # Project CRUD + detail
│   │   │   ├── s/[shortId]/  # Shared content
│   │   │   ├── settings/     # User settings
│   │   │   ├── sign-in/      # Auth: credentials + OAuth
│   │   │   ├── sign-up/      # Auth: registration
│   │   │   ├── snippets/     # Code snippets
│   │   │   ├── offline/      # PWA offline fallback
│   │   │   ├── page.tsx      # Landing page
│   │   │   └── layout.tsx
│   │   └── api/              # API routes (18 endpoints)
│   │       ├── auth/         # NextAuth + sign-up
│   │       ├── cron/         # Scheduled cleanup
│   │       ├── execute/      # Code execution + SSE stream
│   │       ├── executions/   # History
│   │       ├── health/       # DB + Redis health check
│   │       ├── me/           # User profile
│   │       ├── projects/     # Projects CRUD + files + packages
│   │       ├── runtimes/     # Cached Piston runtimes
│   │       ├── s/[shortId]/  # Burn-after-read share
│   │       ├── share/        # Share links
│   │       └── snippets/     # Snippets CRUD
│   ├── components/           # React components
│   │   ├── ui/               # 25 shadcn/ui primitives
│   │   ├── layout/           # Header, user menu, theme, i18n
│   │   ├── editor/           # CodeEditor, Playground, Terminal, 3D
│   │   ├── project/          # ProjectEditor, FileTree, PackageManager
│   │   ├── collab/           # CollabPresence (Yjs)
│   │   ├── share/            # ShareDialog with QR codes
│   │   ├── pwa/              # Service Worker registration
│   │   └── providers.tsx     # Session, Query, Theme, Tooltip
│   ├── lib/                  # Server + shared utilities
│   │   ├── auth/             # NextAuth config + Drizzle adapter
│   │   ├── db/               # Drizzle schema (15 tables) + client
│   │   ├── execution/        # Piston client + 19 languages
│   │   ├── storage/          # Redis + Vercel Blob
│   │   ├── collab/           # Yjs Hocuspocus hooks
│   │   ├── validators/       # Zod schemas (5 files)
│   │   ├── i18n/             # next-intl config + routing
│   │   ├── packages/         # Package manager utilities
│   │   └── utils/            # 15 utility functions
│   ├── messages/             # i18n: en, zh-CN, ja, ko, es, fr
│   ├── stores/               # Zustand editor state (persisted)
│   └── proxy.ts              # next-intl middleware
├── public/                   # Static assets + manifest.json + sw.js
├── drizzle/                  # Generated migrations
├── tests/
│   ├── unit/                 # Vitest: utils, languages, validators
│   └── e2e/                  # Playwright: home, sign-in, playground
├── infra/
│   ├── collab-server/        # Docker + Fly.io (Hocuspocus/Yjs)
│   └── piston/               # Docker + Fly.io (Piston sandbox)
├── scripts/
│   └── seed.ts               # Database seeding
├── .github/workflows/        # CI (lint, typecheck, test, build)
│   ├── ci.yml
│   └── vercel-preview.yml
└── LICENSE
```

## 🔐 Environment Variables

See `.env.example` for the full list. Required:

- `POSTGRES_URL` - Database
- `AUTH_SECRET` - NextAuth secret
- `AUTH_URL` - Public URL
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` - Redis
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob
- `PISTON_API_URL` - Piston endpoint (default: emkc.org)

Optional:
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` - GitHub OAuth
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` - Google OAuth
- `SENTRY_DSN` - Error tracking

## 🚀 Deployment (Vercel)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

The execution sandbox runs via Piston API. For self-hosting Piston:
```bash
git clone https://github.com/engineer-man/piston
cd piston
docker compose up
# Piston now at http://localhost:2000/api/v2
```

## 📜 License

MIT
