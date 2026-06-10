# Piston — code execution backend

This directory has two ways to run the code-execution backend that
DocForge's `/api/execute` talks to.

|            | [piston-shim/](./piston-shim/) (default)                                                                            | [piston/](./piston/) (legacy Docker stack)     |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Needs      | Node 20+, system toolchains (`python3`, `node`, `gcc`, …)                                                           | Docker + ~2 GB of prebuilt runtimes            |
| Cold start | < 1 s                                                                                                               | ~30 s (image pull)                             |
| Isolation  | per-job temp dir + wall-clock timer + rlimit-style output cap                                                       | cgroup v2 + namespaces + seccomp               |
| Runtimes   | 14 (Python 3.14, Node 24, TypeScript, C/C++ 13, Go 1.25, Rust, Java 25, Ruby 3.4, PHP, Perl, Swift 6, SQLite, Bash) | 40+ (anything upstream Piston supports)        |
| Best for   | local dev, CI, self-hosting                                                                                         | production with untrusted multi-tenant traffic |

> **Why we ship a shim:** the public Piston API
> (`https://emkc.org/api/v2/piston`) became **whitelist-only on
> 2026-02-15** — every request without a key gets a 401. The shim is a
> drop-in replacement that speaks the same `/api/v2/runtimes` and
> `/api/v2/execute` endpoints, using the compilers/runtimes you already
> have on `PATH`. It is enabled by default in DocForge's `.env`.

## Default: local shim

```bash
make piston-up      # start  (idempotent, pidfile-tracked)
make piston-status  # inspect
make piston-down    # stop
make piston-logs    # tail log
```

Source lives in [`piston-shim/`](./piston-shim/). Override the URL in
`.env` if you want to point at a different host:

```env
PISTON_API_URL="http://127.0.0.1:2000/api/v2"
```

## Optional: full Docker stack (upstream Piston)

The original `docker-compose.yml` and `fly.toml` are kept here for teams
that need cgroup-isolated multi-tenant execution. To use it:

```bash
cd infra/piston
docker compose up -d             # first boot downloads ~2 GB of runtimes
# then point DocForge at it:
#   PISTON_API_URL="http://localhost:2000/api/v2"
```

## API connection

Both backends expose the exact same Piston v3 API. DocForge's
[`src/lib/execution/piston.ts`](../../src/lib/execution/piston.ts) reads
`PISTON_API_URL` (and optional `PISTON_API_KEY`) at request time, so
swapping backends is just a config change.

## Security notes

- The shim **does not** provide kernel-level isolation. Don't expose it
  to untrusted internet traffic without a reverse proxy that enforces
  authentication.
- For multi-tenant / untrusted workloads, deploy the Docker stack above
  (or the upstream hosted Piston) and use `PISTON_API_KEY` for auth.
- All execution paths in DocForge already rate-limit via Redis
  (`RATE_LIMIT_EXECUTE_PER_MIN`, default 20 req/min/IP).
