# Piston self-hosted execution backend

This is the code-execution backend for OnlineCode. Piston is a high-performance, secure code execution engine originally built by [engineer-man](https://github.com/engineer-man/piston).

## Why Piston?

- 40+ language runtimes pre-bundled (Python 3.11, Node 22, TypeScript, C/C++, Java 21, Rust, Go, C#, PHP, Ruby, Kotlin, Swift, Scala, Bash, Lua, SQL, etc.)
- Per-stage resource limits (CPU, wall time, memory, disk, network)
- Hermetic isolation via namespaces + cgroups
- HTTP API, no state — perfect for serverless
- MIT licensed, self-hostable

## Package Support (pip / npm / cargo / go)

**Network is ENABLED** in this configuration so package managers can download dependencies at runtime. When a user adds packages in the Playground sidebar (e.g. `numpy`, `lodash`, `serde`), OnlineCode:

1. Generates a bash setup script that installs all packages (`pip install numpy pandas`, `npm install lodash axios`, etc.)
2. Sends the script + user code to Piston
3. Piston executes the setup script first (install packages), then runs the user's code

**Supported ecosystems at runtime:**
| Language | Command | Example |
|----------|---------|---------|
| Python | `pip install` | numpy, pandas, requests |
| JavaScript/TS | `npm install` | lodash, axios, @types/node |
| Rust | `cargo add` | serde, tokio, anyhow |
| Go | `go get` | github.com/gin-gonic/gin |
| Ruby | `gem install` | rails, sinatra |

## Why not Vercel Serverless?

Vercel serverless functions cannot run arbitrary user code safely and have restrictive resource limits. Piston provides true isolation with cgroup v2.

## Local development

```bash
cd infra/piston
docker compose up -d
# First boot downloads runtimes (~2GB). Subsequent boots are instant.
curl http://localhost:2000/api/v2/runtimes
```

## Production deployment (Fly.io)

```bash
curl -L https://fly.io/install.sh | sh
fly apps create onlinecode-piston
fly volumes create piston_cache --size 10
fly secrets set PISTON_KEY=$(openssl rand -hex 32)
fly deploy
```

## API connection

Set in OnlineCode's `.env`:
```env
PISTON_API_URL=http://localhost:2000/api/v2     # local
PISTON_API_URL=https://onlinecode-piston.fly.dev/api/v2  # Fly.io
PISTON_API_KEY=<your-secret>
```

The `/api/execute` route already supports these env vars.

## Security notes

- Network is **enabled** to support package installation at runtime
- CPU/memory/wall time limits apply per execution
- Each execution runs in a fresh sub-namespace
- Use `PISTON_KEY` authentication in production
- For sensitive deployments, consider a separate package pre-warming step
