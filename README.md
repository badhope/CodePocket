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

## ✨ Features

- 🌐 **20+ languages**: Python, JS, TS, C, C++, Rust, Go, Java, C#, PHP, Ruby, Kotlin, Swift, Scala, Bash, Lua, SQL, HTML, CSS
- ⚡ **Piston execution**: Secure code execution via Piston API (self-hostable)
- 📁 **Multi-file projects**: File tree, tabbed editing, version history
- 🔐 **Full auth**: Email/password, GitHub & Google OAuth, JWT sessions
- 👥 **Collaboration-ready**: Yjs CRDT infrastructure
- 🌍 **6 locales**: English, Chinese, Japanese, Korean, Spanish, French
- 🎨 **Themes**: Light/Dark/System with shadcn/ui
- 📦 **Storage**: Vercel Blob + Vercel Postgres
- 🛡️ **Security**: Rate limiting, CORS, CSP, HSTS, bcrypt(12)
- 📱 **PWA**: Installable, offline-capable
- 🔭 **Observability**: Sentry, structured logs
- 🧪 **Tests**: Vitest (unit) + Playwright (E2E)
- 🚀 **CI/CD**: GitHub Actions + Vercel

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
│   │   │   ├── sign-in/
│   │   │   ├── sign-up/
│   │   │   ├── page.tsx      # Homepage
│   │   │   └── layout.tsx
│   │   └── api/              # API routes
│   │       ├── auth/         # NextAuth
│   │       ├── projects/     # Projects CRUD
│   │       ├── execute/      # Code execution
│   │       ├── share/        # Share links
│   │       └── health/       # Health check
│   ├── components/           # React components
│   │   ├── ui/               # shadcn primitives
│   │   └── layout/           # Header, user menu, etc.
│   ├── lib/                  # Server + shared utilities
│   │   ├── auth/             # NextAuth config
│   │   ├── db/               # Drizzle schema + client
│   │   ├── execution/        # Piston client + languages
│   │   ├── storage/          # Redis + Blob
│   │   ├── validators/       # Zod schemas
│   │   ├── i18n/             # next-intl config
│   │   └── utils/            # Helpers
│   ├── messages/             # i18n message catalogs
│   └── proxy.ts              # next-intl middleware (Next 16)
├── drizzle/                  # Generated migrations
├── public/                   # Static assets + PWA
├── tests/                    # E2E tests
└── .github/workflows/        # CI
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
