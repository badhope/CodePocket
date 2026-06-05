# piston-shim

Lightweight, **Piston-compatible** code-execution API used as a drop-in
replacement for `https://emkc.org/api/v2/piston`.

The public Piston API went **whitelist-only on 2026-02-15**, so DocForge's
`/api/execute` started returning 401. This shim implements the exact same
two endpoints (`/api/v2/runtimes` and `/api/v2/execute`) using the system
toolchains (Node, Python, GCC, Go, Rust, etc.) and is suitable for local
development and self-hosted deployments.

It does **not** use Docker or `isolate(1)`; isolation is provided by:
- per-job temp directory (`chmod 0700`)
- `ulimit` style hard wall-clock timer (SIGKILL on timeout)
- per-stream output cap (1 MiB)
- per-job memory cap is enforced at the OS level by the kernel

For a production-grade sandbox (cgroup v2, seccomp, network namespaces)
you should swap this for [engineer-man/piston](https://github.com/engineer-man/piston)
in a real deployment. See `../piston/` for the upstream source we mirrored.

## Quick start

```bash
cd infra/piston-shim
pnpm install     # or: npm install
node server.mjs  # listens on 127.0.0.1:2000
```

Environment variables:
| var | default | purpose |
| --- | --- | --- |
| `PISTON_SHIM_PORT` | `2000` | HTTP port |
| `PISTON_SHIM_BIND` | `127.0.0.1` | bind address |
| `PISTON_DATA_DIR`  | `/tmp/piston-shim-data` | temp working dirs |
| `PISTON_DISABLE_NETWORK` | unset | set to `1` to strip proxy env |

## Supported runtimes

| language   | version  | aliases               |
| ---------- | -------- | --------------------- |
| python     | 3.14.4   | py, py3, python3      |
| javascript | 24.15.0  | js, node              |
| typescript | 5.x      | ts                    |
| bash       | 5.x      | sh, shell             |
| c          | 13.3.0   | gcc                   |
| c++        | 13.3.0   | cpp, g++              |
| ruby       | 3.4.4    | rb                    |
| go         | 1.25.1   | golang                |
| rust       | stable   | rs                    |
| java       | 25       | javac                 |
| php        | 8.x      |                       |
| perl       | 5.x      | pl                    |
| sqlite3    | 3.x      | sql, sqlite           |
| swift      | 6.x      |                       |

Languages not in this list will be reported by `/api/v2/runtimes` as
"unknown runtime" if the upstream DocForge code asks for them, which is
the same behaviour Piston itself has for un-installed runtimes.
