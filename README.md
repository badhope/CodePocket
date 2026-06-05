# DocForge

> **Offline-first developer toolbox.** 20 browser tools, a polyglot code
> playground, and a full document-conversion engine — every one of them runs
> in the browser with **zero backend dependency**. The optional backend only
> unlocks account, collaboration, and high-fidelity DOCX/PDF/XLSX output.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-dc382d?logo=redis)](https://redis.io)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-c5f74f)](https://orm.drizzle.team)
[![Tests](https://img.shields.io/badge/vitest-52%20unit-6e9f18?logo=vitest)](./src/lib)
[![Audit](https://img.shields.io/badge/pnpm%20audit-0%20CVE-success)]()

## The 20 tools

All available at `/[locale]/tools` and **fully offline** — no fetch, no
network roundtrip. Grouped by category:

| Category | Tools |
| -------- | ----- |
| **format** | JSON formatter, CSS formatter, SQL formatter, HTML formatter |
| **convert** | YAML⇄JSON, TOML⇄JSON, CSV⇄JSON, Markdown⇄HTML |
| **encode** | Base64, URL, Hash (SHA family), JWT decoder |
| **generate** | UUID, Color (HEX/RGB/HSL), Number-base, Lorem ipsum, QR code |
| **parse** | Cron, Regex tester, Text diff |

All 20 are wired through the offline-first state machine
(`useBackendStatus` + feature gate) and degrade gracefully when the
backend is offline — none of them is a stub.

## Features

- **20 offline tools** — every tool runs in the browser; the page works
  even if the API routes 503. The `BackendStatusOverview` component shows
  the live state so users know when a feature is degraded.
- **Polyglot code playground** — Python 3 (Pyodide), JavaScript /
  TypeScript (Web Worker transpile), Lua (fengari-web), SQL (sql.js).
  Backend also wires 14+ system toolchains through the local Piston shim
  (see below).
- **Document conversion** — DOCX ⇄ PDF ⇄ Markdown ⇄ HTML ⇄ XLSX ⇄ CSV
  ⇄ JSON ⇄ XML ⇄ PPTX via the in-browser `client-tools` engine. Backend
  adds server-side DOCX / PDF / XLSX rendering for high-fidelity output.
- **Auth & accounts** — NextAuth v5 (credentials + GitHub/Google OAuth).
  Entirely optional; the 20 tools are reachable without signing in.
- **Persistence** — Postgres 16 via Drizzle ORM (users, sessions, accounts,
  executions, projects, snippets, shares, teams, …). Only used by
  optional features.
- **Rate limiting** — sliding-window via Redis 7 (local) or Upstash REST
  (production). When no Redis backend is configured, the route returns
  **503** — there is no silent fail-open.
- **Realtime collab** — Yjs + Hocuspocus in
  [`infra/collab-server`](./infra/collab-server); the editor falls back to
  single-user mode when `NEXT_PUBLIC_COLLAB_URL` is unset.
- **i18n** — English, Chinese, Japanese, Korean, Spanish, French
  (next-intl).
- **Static export** — `pnpm build:gh-pages` builds a self-contained
  static site that runs at `100%` in the browser with no backend
  (`NEXT_PUBLIC_STATIC_DEMO=1`).
- **PWA** — service worker, install prompt, offline shell for the
  tools + editor.

## Quick start

```bash
# 1. Install
pnpm install

# 2. (Recommended) start Postgres + Redis + Piston-shim
make up

# 3. Dev server
make dev          # -> http://localhost:3000

# 4. (Alternative) static export — no backend at all
pnpm build:gh-pages
```

If you only want the offline tools and playground, **skip step 2**.
`pnpm dev` will boot the Next.js server and the tools will work
immediately; the `/offline` page shows the live backend status.

### What `make up` does

- start the `main` Postgres 16 cluster on 5432
- start `redis-server` on 6379
- start the local **Piston shim** on `127.0.0.1:2000`
- create the `docforge` and `docforge_shadow` databases with the `docforge` role
- apply every SQL file in `drizzle/` (idempotent via `drizzle.__drizzle_migrations`)

### Why a local Piston shim?

The public Piston API at `https://emkc.org/api/v2/piston` has been
**whitelist-only since 2026-02-15** — unauthenticated traffic gets a 401.
To keep `/api/execute` working offline and self-hosted, DocForge ships a
small Piston-compatible service in [`infra/piston-shim/`](./infra/piston-shim).
It speaks the exact same two endpoints (`/api/v2/runtimes` and
`/api/execute`) using the system toolchains already on your `PATH`
(Python 3, Node 24, GCC 13, Go 1.25, Rust, Java 25, Ruby, PHP, Perl,
Swift, SQLite, TypeScript). 14 runtimes in 200 lines of Node — no Docker,
no `isolate(1)`, no cgroup v2 setup.

```bash
make piston-up      # start the shim (idempotent, pidfile-tracked)
make piston-down    # stop the shim
make piston-status  # print process state + runtime catalog
make piston-logs    # tail the log file
```

For real production-grade isolation (cgroups, seccomp, network
namespaces), point `PISTON_API_URL` at a self-hosted instance of
[engineer-man/piston](https://github.com/engineer-man/piston) or the
official hosted endpoint if you have a whitelist key.

## The `make` cheat sheet

| target           | what it does                                                    |
| ---------------- | --------------------------------------------------------------- |
| `make up`        | start Postgres + Redis + Piston-shim, apply migrations          |
| `make down`      | stop Postgres + Redis + Piston-shim                             |
| `make status`    | print cluster / redis / Piston status                           |
| `make dev`       | `pnpm dev`                                                      |
| `make build`     | `pnpm build` (production)                                       |
| `make test`      | `pnpm test` (vitest)                                            |
| `make lint`      | `pnpm lint`                                                     |
| `make typecheck` | `tsc --noEmit`                                                  |
| `make smoke`     | end-to-end Python venv + Postgres + Redis + Next.js + Piston check |
| `make db-reset`  | **destructive** — drop and re-create the local databases        |
| `make db-studio` | open Drizzle Studio against the local DB                        |
| `make bootstrap` | first-time setup: create role/dbs + apply migrations + install  |

There is also a small CLI wrapper:

```bash
./scripts/dev.sh up      # == make up
./scripts/dev.sh status  # == make status
./scripts/dev.sh dev     # == make up && pnpm dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Next.js 16 (App Router)                       │
│                                                                       │
│   src/app/[locale]/**      — pages (en/zh-CN/ja/ko/es/fr)            │
│   src/app/api/**           — route handlers (convert, execute, …)    │
│   src/lib/system/          — offline-first state machine              │
│      backend-status.ts     —   useSyncExternalStore snapshot of /api/health│
│      feature-gate.ts       —   capability map (LOCAL_FEATURES, …)    │
│   src/lib/tools/           — 20 in-browser tools (client-tools.ts)    │
│   src/lib/execution/       — Piston client + frontend-runner (WASM)   │
│   src/lib/collab/          — Yjs / Monaco hooks (use-y-collab)       │
│                                                                       │
│   Feature gate ──►  if local  →  in-browser runner                    │
│                    if remote →  /api/* → Piston shim                 │
└────────────┬───────────────────────────────────────────┬───────────┘
             │                                           │
   optional ▼                                  optional ▼
   ┌──────────────────┐                     ┌──────────────────────┐
   │  PostgreSQL 16   │                     │  Piston-shim         │
   │  (Drizzle ORM)   │                     │  (127.0.0.1:2000)    │
   └──────────────────┘                     └──────────────────────┘
             │                                           │
             └──────────►  Redis 7  ◄────────────────────┘
                          (sliding-window rate limit)
```

### Offline-first state machine

Every page subscribes to a single `useBackendStatus()` hook backed by
`useSyncExternalStore`. The status moves through five states:

```
unknown ──► checking ──► online    ──► degraded
                          online   ◄──┘
                          online   ──► offline
                          offline  ──► online  (recheck)
```

The `feature-gate` module maps every `FeatureId` to either
`"local"` (browser-only) or `"remote"` (needs API). A `"local"` feature
**always** works — even if the API is down — and a `"remote"` feature
**always** reports its degraded state honestly. There is no
"fake success" path: the `BackendStatusOverview` and
`BackendStatusBanner` components surface the real state to the user.

## Environment variables

Everything lives in `.env`. See [`.env.example`](./.env.example) for
the full annotated list. The essentials:

| variable                    | purpose                                                      |
| --------------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_STATIC_DEMO`   | `1` to force pure-frontend mode (default for gh-pages build) |
| `NEXT_PUBLIC_COLLAB_URL`    | Yjs WebSocket URL; unset = single-user mode                  |
| `POSTGRES_URL`              | primary database connection string                           |
| `AUTH_SECRET`               | NextAuth v5 secret (32+ chars)                               |
| `AUTH_URL`                  | canonical app URL                                            |
| `AUTH_GITHUB_ID/SECRET`     | optional GitHub OAuth                                        |
| `UPSTASH_REDIS_REST_*`      | Upstash REST URL + token (production)                        |
| `RATE_LIMIT_*`              | `RATE_LIMIT_CONVERT_PER_MIN`, `_API_PER_MIN`, …              |
| `MAX_FILE_SIZE_MB`          | upload cap (default 50MB)                                    |
| `SENTRY_DSN`                | optional error reporting                                     |
| `PISTON_API_URL`            | URL of the (local) Piston-shim or a whitelisted Piston host  |
| `COLLAB_REQUIRE_AUTH`       | `true` to require a shared secret on the collab-server       |
| `COLLAB_SHARED_SECRET`      | required when `COLLAB_REQUIRE_AUTH=true`                     |
| `COLLAB_MAX_DOCS`           | max concurrent rooms in memory (default 1000)                |
| `COLLAB_DOC_TTL_MS`         | inactive-doc eviction window (default 1h)                    |

## Project layout

```
src/
├── app/
│   ├── [locale]/             # Localized pages (en, zh-CN, ja, ko, es, fr)
│   │   ├── convert/          # Document conversion UI
│   │   ├── tools/            # The 20 offline tools (/tools, /tools/[slug])
│   │   ├── playground/       # Code playground (Piston + frontend runner)
│   │   ├── projects/         # Project management
│   │   ├── snippets/         # Snippet sharing
│   │   ├── dashboard/        # User dashboard
│   │   ├── settings/         # Account settings
│   │   ├── offline/          # Backend-status help page
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
│       ├── collab/token/     # short-lived collab token (HS256)
│       ├── health/           # DB / cache / memory probe (state machine source)
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
│   ├── system/               # offline-first state machine + feature gate
│   ├── tools/                # 20 client-side tools (client-tools.ts)
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
make test       # vitest (52 unit tests across 17 files)
make lint       # eslint (0 errors, 0 warnings)
make typecheck  # tsc --noEmit (0 errors)
```

End-to-end (Playwright) is scaffolded but not yet wired in CI:

```bash
pnpm test:e2e
```

A security audit of every transitive dependency resolves to zero
moderate-or-above CVEs (`pnpm audit` exits clean); see
`pnpm.overrides` in [`package.json`](./package.json) for the
forced-upgrade pins.

## Production deployment

The app is a standard Next.js 16 project — `pnpm build && pnpm start`
works on Vercel, Render, Fly.io, or any container host. Two
deployment profiles are supported:

**Full stack (with backend)** — set `NEXT_PUBLIC_STATIC_DEMO=0` (or
leave it unset) and bring up Postgres, Redis, and Piston-shim. Account,
collab, and high-fidelity DOCX/PDF/XLSX output are enabled.

**Static export (browser-only)** — `pnpm build:gh-pages` produces a
self-contained static site; deploy the `out/` directory to GitHub Pages,
Cloudflare Pages, or any static host. All 20 tools and the
playground work without any backend. The collab-server can be
deployed independently (see [`infra/collab-server/`](./infra/collab-server)).

In production (full stack):

- swap `REDIS_URL` for `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- point `POSTGRES_URL` at a managed Postgres (Neon, Supabase, RDS, …)
- optionally set `BLOB_READ_WRITE_TOKEN` for Vercel Blob uploads
- optionally set `SENTRY_DSN` for error reporting

The same Drizzle migration files in `drizzle/` run via
`pnpm db:migrate` in CI.

## Other packages in this repo

This repository is a monorepo with two companion clients plus the main
Next.js app:

```
OnlineCode/
├── (this Next.js 16 app — root)
├── infra/
│   ├── piston-shim/        # Piston-compatible code-execution API (Node.js)
│   └── collab-server/      # Yjs / Hocuspocus WebSocket server
└── miniprogram/            # Taro-based WeChat Mini Program (companion)
```

| command             | what it does                                             |
| ------------------- | -------------------------------------------------------- |
| `pnpm mp:dev`       | `cd miniprogram && npm run dev:weapp` — Taro dev server |
| `pnpm mp:build`     | `cd miniprogram && npm run build:weapp` — Taro build    |
| `make piston-up`    | start the local Piston shim (port 2000)                  |
| `make piston-down`  | stop the local Piston shim                               |

The Mini Program shares the same backend over the same Next.js API
routes; it does **not** include any of the offline-first browser
tooling (the 20 tools and Monaco editor are web-only by design).

## License

MIT
