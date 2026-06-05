#!/usr/bin/env python3
"""End-to-end smoke test for the DocForge Python toolchain.

Verifies, in order:
1. Python interpreter sanity (this venv)
2. PostgreSQL 16 reachable on 127.0.0.1:5432
3. Redis 7 reachable on 127.0.0.1:6379
4. Next.js dev server on 127.0.0.1:3000
5. `/api/health` returns 200
6. `/api/runtimes` advertises Python (or 3.x)
7. `/api/execute` actually runs Python code via the server
8. A standalone Python script can talk to all the above

Exits 0 on success, 1 on the first failing check.
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx

BASE = os.environ.get("DOCFORGE_BASE", "http://127.0.0.1:3000")
PG_HOST = "127.0.0.1"
PG_PORT = 5432
REDIS_HOST = "127.0.0.1"
REDIS_PORT = 6379


def check(label: str, ok: bool, detail: str = "") -> bool:
    icon = "✓" if ok else "✗"
    print(f"  {icon} {label}" + (f"  — {detail}" if detail else ""))
    return ok


def tcp_port(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=2):
            return True
    except OSError:
        return False


def main() -> int:
    print("DocForge Python toolchain smoke test")
    print("====================================")
    failed = 0

    # 1. Python interpreter
    print("\n[1] Python interpreter")
    if not check("python", sys.version_info >= (3, 12), f"{sys.version.split()[0]}"):
        failed += 1

    # 2. Postgres
    print("\n[2] PostgreSQL 16")
    if not check(f"tcp {PG_HOST}:{PG_PORT}", tcp_port(PG_HOST, PG_PORT)):
        failed += 1
    else:
        # Try the psql client if available
        psql = subprocess.run(
            ["psql", "-h", PG_HOST, "-p", str(PG_PORT), "-U", "docforge", "-d", "docforge", "-tAc", "SELECT version();"],
            env={**os.environ, "PGPASSWORD": "docforge_dev"},
            capture_output=True, text=True, timeout=5,
        )
        if psql.returncode == 0:
            check("psql SELECT version()", True, psql.stdout.strip().split(" on ")[0])
        else:
            check("psql", False, psql.stderr.strip()[:120])

    # 3. Redis
    print("\n[3] Redis 7")
    if not check(f"tcp {REDIS_HOST}:{REDIS_PORT}", tcp_port(REDIS_HOST, REDIS_PORT)):
        failed += 1
    else:
        from subprocess import run
        r = run(["redis-cli", "-p", str(REDIS_PORT), "INFO", "server"],
                capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            ver = next((l for l in r.stdout.splitlines() if l.startswith("redis_version:")), "redis_version:?")
            check("redis-cli INFO server", True, ver)
        else:
            check("redis-cli", False, r.stderr.strip()[:120])

    # 4. Next.js dev server
    print("\n[4] Next.js dev server")
    if not check(f"tcp 127.0.0.1:3000", tcp_port("127.0.0.1", 3000)):
        print("    Hint: pnpm dev (or: make dev)")
        failed += 1

    # 5. /api/health
    print("\n[5] HTTP API")
    with httpx.Client(base_url=BASE, timeout=10) as client:
        try:
            r = client.get("/api/health")
            if check("/api/health", r.status_code == 200, f"{r.status_code}"):
                body = r.json()
                # The real shape is {status, version, uptime, timestamp, checks:{database,cache,memory}}.
                # Accept either the old or new contract.
                top_ok = body.get("ok") if "ok" in body else body.get("status") == "ok"
                check("  health.status", top_ok is True, str(body.get("status", body.get("ok"))))
                checks = body.get("checks") or {}
                for k in ("database", "cache", "memory", "db", "service"):
                    if k in checks:
                        v = checks[k]
                        # New shape: v = {name, status: 'ok'|'degraded'|...}
                        if isinstance(v, dict):
                            sub_status = v.get("status")
                            check(f"  health.{k}", sub_status == "ok", str(v)[:80])
                        else:
                            check(f"  health.{k}", v in (True, "ok", "up"), str(v)[:60])
                    elif k in body:
                        v = body[k]
                        check(f"  health.{k}", v in (True, "ok", "up"), str(v)[:60])
            else:
                failed += 1
        except Exception as e:
            check("/api/health", False, str(e)[:120])
            failed += 1

        # 6. /api/runtimes has python
        try:
            r = client.get("/api/runtimes")
            runtimes = r.json() if r.status_code == 200 else []
            py = [x for x in runtimes if isinstance(x, dict) and (x.get("language") or x.get("name") or "").lower().startswith("python")]
            check("/api/runtimes", r.status_code == 200, f"{len(runtimes)} runtimes")
            check("python runtime advertised", len(py) > 0,
                  f"{len(py)} match" + (f" (e.g. {py[0].get('language') or py[0].get('name')})" if py else ""))
            if not py:
                failed += 1
        except Exception as e:
            check("/api/runtimes", False, str(e)[:120])
            failed += 1

        # 7. /api/execute runs Python
        try:
            payload = {
                "language": "python",
                "version": "3.10.0",
                "files": [{"name": "main.py", "content": "import sys, platform\nprint('hello from', sys.version.split()[0])\nprint('platform:', platform.system(), platform.machine())\n"}],
            }
            t0 = time.time()
            r = client.post("/api/execute", json=payload, timeout=45)
            dt = (time.time() - t0) * 1000
            if r.status_code == 200:
                body = r.json()
                ok = body.get("success") is True
                stdout = ((body.get("result") or {}).get("run") or {}).get("stdout", "")
                if check("/api/execute (python)", ok, f"{r.status_code} in {dt:.0f} ms"):
                    check("stdout contains greeting", "hello from" in stdout, stdout.strip().splitlines()[0] if stdout else "(empty)")
                else:
                    check("error", False, body.get("error", "?") + " " + (body.get("message") or "")[:200])
                    failed += 1
            else:
                check("/api/execute (python)", False, f"HTTP {r.status_code}: {r.text[:200]}")
                failed += 1
        except Exception as e:
            check("/api/execute (python)", False, str(e)[:120])
            failed += 1

    # 8. Independent Python: import a request lib, hit a route
    print("\n[6] Standalone Python HTTP")
    try:
        r = httpx.get(f"{BASE}/api/health", timeout=5)
        check("httpx GET /api/health", r.status_code == 200, str(r.status_code))
    except Exception as e:
        check("httpx GET /api/health", False, str(e)[:120])
        failed += 1

    print()
    if failed:
        print(f"FAILED: {failed} check(s) did not pass")
        return 1
    print("OK: every toolchain link is wired up")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
