# Piston self-hosted execution backend

This is the code-execution backend for OnlineCode. Piston is a high-performance, secure code execution engine originally built by [engineer-man](https://github.com/engineer-man/piston) and used widely for online judges.

## Why Piston?

- 40+ language runtimes pre-bundled (Python 3.11, Node 22, TypeScript, C/C++, Java 21, Rust 1.84, Go 1.23, C#, PHP, Ruby, Kotlin, Swift, Scala, Bash, Lua, SQL, etc.)
- Per-stage resource limits (CPU, wall time, memory, disk, network)
- Hermetic isolation via namespaces + cgroups
- HTTP API, no state — perfect for serverless
- MIT licensed, can be self-hosted

## Why not Vercel Serverless?

Vercel serverless functions:
- Max 300s execution (we need 30-60s per stage)
- No namespace/cgroup isolation
- Cannot run arbitrary user code safely
- Each cold start costs 100-500ms
- 250MB / 1024MB function memory cap

Piston:
- Dedicated VM (4GB RAM / 4 vCPU recommended)
- True isolation with cgroup v2
- Cold start once per language (cache dir persists)
- 32+ concurrent runs per VM
- Pay-per-second on Fly.io (~$7/mo idle, scales to 0)

## Local development

```bash
cd infra/piston
docker compose up -d
curl http://localhost:2000/api/v2/runtimes
```

The first boot downloads all language runtimes (≈2GB). Subsequent boots are instant.

## Production deployment (Fly.io)

```bash
# 1. Install fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Create app
fly apps create onlinecode-piston

# 3. Create persistent volume
fly volumes create piston_cache --size 10

# 4. Set secrets
fly secrets set PISTON_KEY=$(openssl rand -hex 32)

# 5. Deploy
fly deploy
```

## API

The OnlineCode app calls Piston via the env var `PISTON_API_URL`. Default: `https://emkc.org/api/v2/piston` (free public Piston instance, rate-limited).

To use your self-hosted instance:
```env
PISTON_API_URL=https://onlinecode-piston.fly.dev/api/v2
PISTON_API_KEY=<your-secret>
```

The `/api/execute` route in OnlineCode already supports these env vars — no code change required.

## Security

- Network is disabled by default (`PISTON_DISABLE_NETWORK=true`)
- CPU, memory, wall time all limited
- Container runs as non-root inside the Piston container
- Each execution runs in a fresh sub-namespace

For higher security, run on dedicated VMs (not shared) and enable cgroup v2.
