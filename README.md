# DocForge

> Universal document conversion + an in-browser code playground.
> Web (Next.js 16) and a WeChat Mini Program companion, both fed by the same
> Postgres + Redis backend.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-dc382d?logo=redis)](https://redis.io)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-c5f74f)](https://orm.drizzle.team)

## Features

- **Document conversion** — DOCX ⇄ PDF ⇄ Markdown ⇄ HTML ⇄ XLSX ⇄ CSV ⇄ JSON ⇄ XML ⇄ PPTX, with magic-byte validation and rate limiting.
- **Code playground** — 40+ languages via [Piston](https://github.com/engineer-man/piston) on the server, with a browser fallback (Web Workers for JS, TypeScript transpile, Pyodide for Python, sandboxed iframe for HTML) when the backend is unavailable.
- **Auth** — NextAuth v5 (credentials + GitHub/Google OAuth).
- **Persistence** — Postgres 16 via Drizzle ORM (14 tables: users, sessions, accounts, executions, projects, snippets, shares, teams, etc.).
- **Rate limiting** — sliding-window via Redis 7 (local) or Upstash REST (production). No silent fallbacks — the route surfaces a 503 when no Redis backend is configured.
- **i18n** — English, Chinese, Japanese, Korean, Spanish, French (next-intl).
- **PWA** — service worker, offline shell, install prompt.
- **Mini program** — Taro-based WeChat client sharing the same backend.

## Quick start

```bash
# 1. Install system deps (Ubuntu/Debian)
sudo apt-get install -y postgresql redis-server

# 2. Install Node deps
pnpm install

# 3. Start Postgres + Redis and apply migrations
make up

# 4. Run the dev server
make dev
# -> http://localhost:3000
```

That's it. `make up` will:

- start the `main` Postgres 16 cluster on 5432
- start `redis-server` on 6379
- create the `docforge` and `docforge_shadow` databases with the `docforge` role
- apply every SQL file in `drizzle/` (idempotent via `drizzle.__drizzle_migrations`)

## The `make` cheat sheet

| target          | what it does                                                    |
| --------------- | --------------------------------------------------------------- |
| `make up`       | start Postgres + Redis, apply migrations                        |
| `make down`     | stop Postgres + Redis                                           |
| `make status`   | print cluster / redis status                                    |
| `make dev`      | `pnpm dev`                                                      |
| `make build`    | `pnpm build` (production)                                       |
| `make test`     | `pnpm test`                                                     |
| `make lint`     | `pnpm lint`                                                     |
| `make typecheck`| `tsc --noEmit`                                                  |
| `make db-reset` | **destructive** — drop and re-create the local databases        |
| `make db-studio`| open Drizzle Studio against the local DB                        |
| `make bootstrap`| first-time setup: create role/dbs + apply migrations + install  |

There is also a small CLI wrapper:

```bash
./scripts/dev.sh up      # == make up
./scripts/dev.sh status  # == make status
./scripts/dev.sh dev     # == make up && pnpm dev
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Next.js 16 (App Router)                  │
│  src/app/[locale]/**   — pages                                   │
│  src/app/api/**        — route handlers                          │
│  src/lib/auth          — NextAuth v5                             │
│  src/lib/db            — Drizzle ORM + Postgres 16               │
│  src/lib/convert/**    — DOCX/PDF/MD/HTML/XLSX/CSV engine        │
│  src/lib/execution/**  — Piston (cloud) + frontend-runner (WASM) │
│  src/lib/storage/redis — Upstash or local ioredis (sliding win)  │
└────────────┬────────────────────────┬────────────────────────────┘
             │                        │
             │                        ▼
             │              ┌──────────────────────┐
             │              │  Redis 7 (sliding w) │
             │              └──────────────────────┘
             ▼
   ┌──────────────────────┐         ┌──────────────────────┐
   │  PostgreSQL 16 (14   │         │  Piston (cloud) or   │
   │  tables) via Drizzle │         │  localhost:2000      │
   └──────────────────────┘         └──────────────────────┘
```

### Backend-with-fallback

The application is built around a strict contract:

> **The backend is required. If it is not reachable, the user sees an error — never a fake "success".**

Concretely:

- `/api/execute` talks to Piston. If Piston is unreachable or the request fails
  validation, the route returns 4xx/5xx with a structured error body. The
  frontend `playground` component then falls back to the **browser runner**
  (Web Workers for JS, Pyodide for Python, etc.) so the user still gets an
  answer locally.
- `/api/convert` and all rate-limited routes call `checkRateLimit`. If no
  Redis backend is configured, the route returns **503** with a clear
  `serviceUnavailable` body — the previous "fail-open" path that silently
  allowed traffic has been removed.
- All API routes import a single Redis abstraction
  ([`src/lib/storage/redis.ts`](./src/lib/storage/redis.ts)) that picks the
  best backend at runtime: Upstash REST in production, local `ioredis` in
  dev. The same factory is used for the global/route/user sliding-window
  limiter.

## Environment variables

Everything lives in `.env`. See [`.env`](./.env) for the full list; the
essentials are:

| variable                  | purpose                                                    |
| ------------------------- | ---------------------------------------------------------- |
| `POSTGRES_URL`            | primary database connection string                         |
| `POSTGRES_URL_SHADOW`     | used by Drizzle for shadow migrations                      |
| `REDIS_URL`               | local Redis (`redis://127.0.0.1:6379`) — dev only          |
| `UPSTASH_REDIS_REST_URL`  | Upstash REST URL — production                              |
| `UPSTASH_REDIS_REST_TOKEN`| Upstash REST token — production                            |
| `AUTH_SECRET`             | NextAuth v5 secret (32+ chars)                             |
| `AUTH_URL`                | canonical app URL                                          |
| `AUTH_GITHUB_ID/SECRET`   | optional GitHub OAuth                                      |
| `RATE_LIMIT_*`            | `RATE_LIMIT_CONVERT_PER_MIN`, `_EXECUTE_PER_MIN`, etc.     |
| `MAX_FILE_SIZE_MB`        | upload cap (default 50MB)                                  |
| `SENTRY_DSN`              | optional error reporting                                   |

## Project layout

```
src/
├── app/
│   ├── [locale]/             # Localized pages (en, zh-CN, ja, ko, es, fr)
│   │   ├── convert/          # Document conversion UI
│   │   ├── playground/       # Code playground (Piston + frontend runner)
│   │   ├── projects/         # Project management
│   │   ├── snippets/         # Snippet sharing
│   │   ├── dashboard/        # User dashboard
│   │   ├── settings/         # Account settings
│   │   ├── docs/             # Documentation
│   │   └── sign-in|sign-up/  # Auth pages
│   └── api/                  # Route handlers
│       ├── auth/             # NextAuth + sign-up
│       ├── convert/          # POST: convert file
│       ├── convert/formats/  # GET: supported format matrix
│       ├── execute/          # POST: run code via Piston
│       ├── execute/stream/   # POST: streaming run
│       ├── executions/       # history
│       ├── projects/         # CRUD
│       ├── snippets/         # CRUD
│       ├── share/            # short-link sharing
│       ├── s/[shortId]/      # resolve share
│       ├── runtimes/         # Piston runtime catalog
│       ├── health/           # DB/cache/memory probe
│       └── metrics/          # prom-style counters
├── lib/
│   ├── auth/                 # NextAuth config + helpers
│   ├── convert/              # PDF/DOCX/MD/HTML/CSV engine
│   ├── db/                   # Drizzle schema + client
│   ├── execution/            # Piston client + frontend-runner
│   ├── storage/              # Redis abstraction (Upstash or local)
│   ├── i18n/                 # next-intl request config
│   ├── api/                  # CORS, structured logging, rate limiter
│   ├── collab/               # Yjs / Monaco collaboration
│   ├── packages/             # ecosystem metadata
│   ├── validators/           # zod schemas (auth, execute, file, project, snippet)
│   ├── ratelimit.ts          # domain helpers (convert/exec/stream/api)
│   ├── env.ts                # zod-validated env
│   └── constants.ts          # tier limits, roles, statuses
├── components/               # UI primitives + domain components
├── messages/                 # en, zh-CN, ja, ko, es, fr
└── proxy.ts                  # next-intl middleware
```

## Testing

```bash
make test       # vitest
make lint       # eslint (0 errors, ~25 cosmetic warnings)
make typecheck  # tsc --noEmit
```

End-to-end (Playwright):

```bash
pnpm test:e2e
```

## Production deployment

The app is a standard Next.js 16 project — `pnpm build && pnpm start` works
on Vercel, Render, Fly.io, or any container host. In production:

- swap `REDIS_URL` for `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- point `POSTGRES_URL` at a managed Postgres (Neon, Supabase, RDS, …)
- optionally set `BLOB_READ_WRITE_TOKEN` for Vercel Blob uploads
- optionally set `SENTRY_DSN` for error reporting

The same Drizzle migration files in `drizzle/` run via
`pnpm db:migrate` in CI.

## License

MIT
