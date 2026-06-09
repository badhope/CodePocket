# DocForge Collab Server

Standalone Yjs/Hocuspocus WebSocket server for real-time multi-user
editing in the DocForge project editor and snippet view.

## Why separate from Vercel?

Vercel functions do not support long-lived WebSocket connections. We
deploy this server on Fly.io (free tier: 3 shared-1x 256MB VMs) and
point the Next.js client at the `wss://` URL via the
`NEXT_PUBLIC_COLLAB_URL` environment variable.

## Local development

```bash
cd infra/collab-server
npm install
npm start
# Server: ws://localhost:1234
```

In the Next.js app's `.env.local`:

```env
NEXT_PUBLIC_COLLAB_URL=ws://localhost:1234
```

Then open two browser windows on `/en/projects/<id>` and edit the
same file — cursor + content should sync in real time.

## Docker

```bash
docker compose up -d
# Server: ws://localhost:1234
```

## Production (Fly.io)

```bash
fly launch --copy-config
fly secrets set COLLAB_SHARED_SECRET="$(openssl rand -hex 32)"
fly deploy
```

In Vercel project settings:

```
NEXT_PUBLIC_COLLAB_URL=wss://docforge-collab.fly.dev
COLLAB_REQUIRE_AUTH=true
COLLAB_SHARED_SECRET=<same value as fly secrets>
```

## Authentication

- `COLLAB_REQUIRE_AUTH=false` (default): any non-empty token is accepted.
  Use only for local development.
- `COLLAB_REQUIRE_AUTH=true`: the `token` field sent by the client must
  equal `COLLAB_SHARED_SECRET`. The Next.js API issues a short-lived
  token on demand (see `/api/collab-token`).

## Configuration

| Variable                  | Default       | Description                                  |
|---------------------------|---------------|----------------------------------------------|
| `PORT`                    | `1234`        | WebSocket port                               |
| `HOST`                    | `0.0.0.0`     | Bind address                                 |
| `COLLAB_REQUIRE_AUTH`     | `false`       | Require shared secret in client token        |
| `COLLAB_SHARED_SECRET`    | empty         | Shared secret (required if auth enabled)     |
| `COLLAB_MAX_DOCS`         | `1000`        | Max concurrent rooms in memory               |
| `COLLAB_DOC_TTL_MS`       | `3600000`     | Inactive doc eviction window (1h)            |
| `COLLAB_LOG_LEVEL`        | `info`        | `info` / `warn` / `error`                    |

## Limits

- Document size: hard limit is RAM. For 1000 active docs averaging
  100KB of Y.Doc state, expect ~150MB resident.
- Connection cap: `services.concurrency.hard_limit` in `fly.toml`
  (currently 5000).
- Debounce: 1.5s write debounce, 5s max debounce — keeps bandwidth low
  for slow typers without losing responsiveness.
