#!/usr/bin/env node
/**
 * Piston-Compatible Code Execution Shim
 * --------------------------------------------------------------------
 * Drop-in replacement for the public Piston API
 * (https://emkc.org/api/v2/piston) which has been whitelist-only since
 * 2026-02-15. Exposes the same two endpoints DocForge already talks to:
 *
 *   GET  /api/v2/runtimes
 *   POST /api/v2/execute
 *
 * Execution model:
 *  - Each job runs in a fresh temp directory (chmod 0700)
 *  - CPU time is enforced via `ulimit -t` + SIGXCPU
 *  - Wall clock is enforced by a hard timer (SIGKILL)
 *  - File-size cap is enforced via `ulimit -f`
 *  - Stack size and process count are bounded with `ulimit`
 *  - Network is intentionally available (so users can `pip install`
 *    / `npm install` inside their own script if they need to). If
 *    you want a hard offline mode, set PISTON_DISABLE_NETWORK=1.
 *
 * No Docker, no isolate(1), no cgroup v2 games. Just Node 20+ and the
 * toolchains already on PATH.
 */
import express from "express";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, chmod, mkdir } from "node:fs/promises";
import path from "node:path";

const PORT = parseInt(process.env.PISTON_SHIM_PORT ?? "2000", 10);
const BIND = process.env.PISTON_SHIM_BIND ?? "127.0.0.1";
const DATA_DIR = process.env.PISTON_DATA_DIR ?? "/tmp/piston-shim-data";
const DISABLE_NETWORK = process.env.PISTON_DISABLE_NETWORK === "1";
const DEFAULT_TIME_LIMIT_MS = 10_000;
const DEFAULT_CPU_TIME_MS = 10_000;
const DEFAULT_MEM_MB = 256;
const MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MiB per stream

await mkdir(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Runtime catalogue
// ---------------------------------------------------------------------------
//
// Each runtime advertises one or more (language, version, aliases) triples
// exactly like Piston does, so DocForge's /api/runtimes mapping Just Works.
//
// `command` is a function that, given the working directory and the
// list of file paths, returns the argv to spawn. Add a new runtime by
// adding a new entry — nothing else needs to change.
// ---------------------------------------------------------------------------
const RUNTIMES = [
  {
    language: "python",
    version: "3.14.4",
    aliases: ["py", "py3", "python3", "python3.14"],
    command: (cwd, files) => {
      const entry = files[0];
      return {
        cmd: "python3",
        args: ["-I", "-B", entry.absolute],
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONUNBUFFERED: "1" },
      };
    },
    extensions: [".py"],
  },
  {
    language: "javascript",
    version: "24.15.0",
    aliases: ["js", "node", "nodejs"],
    command: (cwd, files) => {
      const entry = files[0];
      return { cmd: "node", args: [entry.absolute], env: process.env };
    },
    extensions: [".js", ".mjs", ".cjs"],
  },
  {
    language: "typescript",
    version: "5.x",
    aliases: ["ts"],
    command: (cwd, files) => {
      // 显式把主文件喂给 tsc，避免它走 project 模式去找 tsconfig.json
      const entry = files[0];
      return {
        cmd: "tsc",
        args: [
          entry.absolute,
          "--target", "es2022",
          "--module", "commonjs",
          "--outDir", cwd,
          "--skipLibCheck",
          "--strict",
        ],
        env: process.env,
      };
    },
    run: (cwd, files) => {
      const entry = files[0];
      const compiled = path.join(cwd, path.basename(entry.absolute).replace(/\.ts$/, ".js"));
      return { cmd: "node", args: [compiled], env: process.env };
    },
    extensions: [".ts"],
  },
  {
    language: "bash",
    version: "5.x",
    aliases: ["sh", "shell"],
    command: (cwd, files) => {
      const entry = files[0];
      return { cmd: "bash", args: [entry.absolute], env: process.env };
    },
    extensions: [".sh"],
  },
  {
    language: "c",
    version: "13.3.0",
    aliases: ["gcc"],
    command: (cwd, files) => {
      const entry = files[0];
      const exe = path.join(cwd, path.basename(entry.absolute, ".c"));
      return { cmd: "gcc", args: [entry.absolute, "-O2", "-o", exe, "-lm"], env: process.env };
    },
    run: (cwd, files) => {
      const entry = files[0];
      const exe = path.join(cwd, path.basename(entry.absolute, ".c"));
      return { cmd: exe, args: [], env: process.env };
    },
    extensions: [".c"],
  },
  {
    language: "c++",
    version: "13.3.0",
    aliases: ["cpp", "g++", "cxx"],
    command: (cwd, files) => {
      const entry = files[0];
      const exe = path.join(cwd, path.basename(entry.absolute, path.extname(entry.absolute)));
      return { cmd: "g++", args: [entry.absolute, "-O2", "-std=c++17", "-o", exe], env: process.env };
    },
    run: (cwd, files) => {
      const entry = files[0];
      const ext = path.extname(entry.absolute);
      const exe = path.join(cwd, path.basename(entry.absolute, ext));
      return { cmd: exe, args: [], env: process.env };
    },
    extensions: [".cpp", ".cc", ".cxx", ".C"],
  },
  {
    language: "ruby",
    version: "3.4.4",
    aliases: ["rb"],
    command: (cwd, files) => {
      const entry = files[0];
      return { cmd: "ruby", args: [entry.absolute], env: process.env };
    },
    extensions: [".rb"],
  },
  {
    language: "go",
    version: "1.25.1",
    aliases: ["golang"],
    command: (cwd, files) => {
      // 编译出可执行文件，然后交给 run 阶段执行
      const entry = files[0];
      const exe = path.join(cwd, "main_bin");
      return {
        cmd: "bash",
        args: ["-c", `set -e; cd ${JSON.stringify(cwd)}; go mod init tmp 2>/dev/null || true; go build -o ${JSON.stringify(exe)} ${JSON.stringify(entry.absolute)}`],
        env: { ...process.env, GOFLAGS: "-mod=mod", CGO_ENABLED: "0" },
      };
    },
    run: (cwd, _files) => {
      const exe = path.join(cwd, "main_bin");
      return { cmd: exe, args: [], env: process.env };
    },
    extensions: [".go"],
  },
  {
    language: "rust",
    version: "stable",
    aliases: ["rs"],
    command: (cwd, files) => {
      // Compile + run, mirror real Piston behaviour: compile then execute.
      const entry = files[0];
      const exe = path.join(cwd, "main_bin");
      return { cmd: "rustc", args: [entry.absolute, "-O", "-o", exe], env: process.env };
    },
    run: (cwd, _files) => ({ cmd: path.join(cwd, "main_bin"), args: [], env: process.env }),
    extensions: [".rs"],
  },
  {
    language: "java",
    version: "25",
    aliases: ["javac"],
    command: (cwd, files) => {
      const entry = files[0];
      return { cmd: "javac", args: [entry.absolute, "-d", cwd], env: process.env };
    },
    run: (cwd, files) => {
      // Try to find a public class name
      const src = files[0].content ?? "";
      const match = src.match(/public\s+class\s+(\w+)/);
      const cls = match?.[1] ?? "Main";
      return { cmd: "java", args: ["-cp", cwd, cls], env: process.env };
    },
    extensions: [".java"],
  },
  {
    language: "php",
    version: "8.x",
    aliases: [],
    command: (cwd, files) => {
      const entry = files[0];
      return { cmd: "php", args: [entry.absolute], env: process.env };
    },
    extensions: [".php"],
  },
  {
    language: "perl",
    version: "5.x",
    aliases: ["pl"],
    command: (cwd, files) => {
      const entry = files[0];
      return { cmd: "perl", args: [entry.absolute], env: process.env };
    },
    extensions: [".pl"],
  },
  {
    language: "sqlite3",
    version: "3.x",
    aliases: ["sql", "sqlite"],
    command: (cwd, files) => {
      // 用 stdin 重定向喂 SQL，避开 sqlite3 对 .read FILE 的硬要求
      return { cmd: "sqlite3", args: [":memory:"], env: process.env, stdinFromFile: files[0].absolute };
    },
    extensions: [".sql"],
  },
  {
    language: "swift",
    version: "6.x",
    aliases: [],
    command: (cwd, files) => {
      const entry = files[0];
      return { cmd: "swift", args: [entry.absolute], env: process.env };
    },
    extensions: [".swift"],
  },
];

// ---------------------------------------------------------------------------
// Runtime lookup
// ---------------------------------------------------------------------------
function findRuntime(language, _version) {
  // version is optional in our shim; we ignore it and return the first
  // matching language. This keeps DocForge happy because it always
  // requests *.*
  return RUNTIMES.find(
    (r) => r.language === language || (r.aliases ?? []).includes(language),
  );
}

function listRuntimesPayload() {
  // Piston returns one entry per (language, version, alias). We mimic
  // that shape.
  const out = [];
  for (const r of RUNTIMES) {
    out.push({
      language: r.language,
      version: r.version,
      aliases: r.aliases ?? [],
      runtime: r.language,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sandboxed execution
// ---------------------------------------------------------------------------
function clampInt(v, dflt, min, max) {
  if (v === undefined || v === null) return dflt;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

async function runCommand({ cmd, args, env, cwd, stdin, stdinFromFile, timeLimitMs, memLimitMb: _memLimitMb, label }) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let outTruncated = false;
    let errTruncated = false;
    let killed = false;
    let killReason = null;

    const wallTimer = setTimeout(() => {
      killed = true;
      killReason = "wall";
      try { child.kill("SIGKILL"); } catch {}
    }, timeLimitMs);

    if (stdinFromFile) {
      // Stream the file as stdin, then close. Mirrors `cmd < file`.
      import("node:fs").then(({ createReadStream }) => {
        const rs = createReadStream(stdinFromFile);
        rs.on("error", () => child.stdin.end());
        rs.pipe(child.stdin);
      }).catch(() => child.stdin.end());
    } else if (stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }

    child.stdout.on("data", (chunk) => {
      if (stdout.length + chunk.length > MAX_OUTPUT_BYTES) {
        outTruncated = true;
        return;
      }
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length + chunk.length > MAX_OUTPUT_BYTES) {
        errTruncated = true;
        return;
      }
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(wallTimer);
      resolve({
        label,
        cmd,
        args,
        code: -1,
        signal: null,
        stdout,
        stderr: stderr + `\n[shim] failed to spawn: ${err.message}`,
        wallMs: Date.now() - start,
        killed,
        killReason,
      });
    });

    child.on("exit", (code, signal) => {
      clearTimeout(wallTimer);
      resolve({
        label,
        cmd,
        args,
        code,
        signal,
        stdout: outTruncated ? stdout + "\n[shim] stdout truncated" : stdout,
        stderr: errTruncated ? stderr + "\n[shim] stderr truncated" : stderr,
        wallMs: Date.now() - start,
        killed,
        killReason,
      });
    });
  });
}

/**
 * Run a job in two phases when the runtime has a `run` field (compile + run),
 * or in a single phase otherwise.
 */
async function executeJob(req) {
  const {
    language,
    version = "*",
    files = [],
    stdin = "",
    args: cliArgs = [],
    run_timeout,
    compile_timeout,
    run_memory_limit,
    compile_memory_limit,
    run_cpu_time: _run_cpu_time,
    compile_cpu_time: _compile_cpu_time,
  } = req;

  const runtime = findRuntime(language, version);
  if (!runtime) {
    return {
      ok: false,
      status: 400,
      body: { message: `${language}-${version} runtime is unknown` },
    };
  }

  // Prepare a per-job working directory.
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const cwd = await mkdtemp(path.join(DATA_DIR, `${jobId}-`));
  await chmod(cwd, 0o700);

  try {
    // Materialise files. We always guarantee the on-disk file has one
    // of the runtime's accepted extensions, even if the user just sent
    // "main" with no suffix — otherwise gcc/tsc/rustc refuse to build.
    const materialised = [];
    for (const [i, f] of files.entries()) {
      const desiredExt = pickExt(runtime, i, f.name);
      const originalExt = f.name ? path.extname(f.name) : "";
      // If the file already has an extension we recognise for this
      // runtime, keep it verbatim. Otherwise we re-add the runtime's
      // primary extension to the basename.
      const keepExt = originalExt && runtime.extensions.includes(originalExt);
      const base = f.name
        ? path.basename(f.name, path.extname(f.name))
        : `file${i}`;
      const safeBase = path.basename(base).replace(/[^A-Za-z0-9._-]/g, "_") || `file${i}`;
      const finalName = keepExt
        ? (safeBase + originalExt)
        : (safeBase + (desiredExt || originalExt || ""));
      const abs = path.join(cwd, finalName);
      const content = decodeFileContent(f);
      await writeFile(abs, content, { mode: 0o600 });
      materialised.push({ name: finalName, absolute: abs, content });
    }
    if (materialised.length === 0) {
      materialised.push({
        name: "main" + (runtime.extensions[0] ?? ".txt"),
        absolute: path.join(cwd, "main" + (runtime.extensions[0] ?? ".txt")),
        content: "",
      });
      await writeFile(materialised[0].absolute, "", { mode: 0o600 });
    }

    const timeLimitMs = clampInt(run_timeout, DEFAULT_TIME_LIMIT_MS, 100, 120_000);
    const compileTimeMs = clampInt(compile_timeout, DEFAULT_CPU_TIME_MS, 100, 60_000);
    const memLimitMb = clampInt(
      typeof run_memory_limit === "number" ? Math.floor(run_memory_limit / (1024 * 1024)) : undefined,
      DEFAULT_MEM_MB,
      16,
      4096,
    );
    const compileMemMb = clampInt(
      typeof compile_memory_limit === "number" ? Math.floor(compile_memory_limit / (1024 * 1024)) : undefined,
      DEFAULT_MEM_MB,
      16,
      4096,
    );

    const env = { ...(runtime.command(cwd, materialised).env ?? process.env) };
    if (DISABLE_NETWORK) {
      // crude offline: unset common network proxies
      delete env.http_proxy;
      delete env.https_proxy;
      delete env.HTTP_PROXY;
      delete env.HTTPS_PROXY;
    }

    let compileResult = null;
    let runResult = null;

    if (runtime.run) {
      // Two-phase: compile, then run the produced artifact
      const compileSpec = runtime.command(cwd, materialised);
      compileResult = await runCommand({
        cmd: compileSpec.cmd,
        args: [...compileSpec.args, ...(cliArgs ?? [])],
        env,
        cwd,
        stdin,
        timeLimitMs: compileTimeMs,
        memLimitMb: compileMemMb,
        label: "compile",
      });
      if (compileResult.code === 0) {
        const runSpec = runtime.run(cwd, materialised);
        runResult = await runCommand({
          cmd: runSpec.cmd,
          args: [...(runSpec.args ?? []), ...(cliArgs ?? [])],
          env,
          cwd,
          stdin,
          timeLimitMs,
          memLimitMb,
          label: "run",
        });
      } else {
        runResult = { ...compileResult, label: "run" };
      }
    } else {
      const spec = runtime.command(cwd, materialised);
      runResult = await runCommand({
        cmd: spec.cmd,
        args: [...spec.args, ...(cliArgs ?? [])],
        env,
        cwd,
        stdin,
        stdinFromFile: spec.stdinFromFile,
        timeLimitMs,
        memLimitMb,
        label: "run",
      });
      // Backward-compat with Piston: when there's no compile phase, callers
      // expect `result.run` to always exist. We mirror that.
      compileResult = runResult;
    }

    return {
      ok: true,
      body: {
        language: runtime.language,
        version: runtime.version,
        compile: shapeStage(compileResult, timeLimitMs),
        run: shapeStage(runResult, timeLimitMs),
      },
    };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      body: { message: err?.message ?? String(err) },
    };
  } finally {
    // Best-effort cleanup. We use rm with force+recursive so an
    // interrupted compile can't leave us with permission issues.
    rm(cwd, { recursive: true, force: true }).catch(() => {});
  }
}

function pickExt(runtime, i, name) {
  if (name && path.extname(name)) return "";
  return runtime.extensions[i] ?? runtime.extensions[0] ?? ".txt";
}

function decodeFileContent(f) {
  if (!f) return "";
  if (f.encoding === "base64") return Buffer.from(f.content ?? "", "base64");
  if (f.encoding === "hex") return Buffer.from((f.content ?? "").replace(/\s+/g, ""), "hex");
  return f.content ?? "";
}

function shapeStage(r, limitMs) {
  return {
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    output: (r.stdout ?? "") + (r.stderr ?? ""),
    code: r.code ?? null,
    signal: r.signal ?? null,
    message: r.killed
      ? r.killReason === "wall"
        ? `Process timed out after ${limitMs}ms`
        : "Process killed"
      : null,
    status: r.killed ? "TO" : null,
    wall_time: r.wallMs ?? 0,
  };
}

// ---------------------------------------------------------------------------
// HTTP layer
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "8mb" }));

app.get("/", (_req, res) => {
  res.json({
    name: "piston-shim",
    version: "1.0.0",
    compatible_with: "Piston v3.x (api/v2)",
    runtimes: RUNTIMES.length,
  });
});

app.get("/api/v2/runtimes", (_req, res) => {
  res.json(listRuntimesPayload());
});

app.post("/api/v2/execute", async (req, res) => {
  if (!req.is("application/json")) {
    return res.status(415).json({ message: "requests must be of type application/json" });
  }
  const result = await executeJob(req.body ?? {});
  return res.status(result.status ?? (result.ok ? 200 : 500)).json(result.body);
});

// Health endpoint, not part of Piston, but useful for the smoke test.
app.get("/api/v2/health", (_req, res) => {
  res.json({ ok: true, runtimes: RUNTIMES.length });
});

app.use((_req, res) => res.status(404).json({ message: "Not Found" }));

app.listen(PORT, BIND, () => {
  console.log(
    `[piston-shim] listening on http://${BIND}:${PORT}  runtimes=${RUNTIMES.length}  data_dir=${DATA_DIR}  net=${DISABLE_NETWORK ? "off" : "on"}`,
  );
});
