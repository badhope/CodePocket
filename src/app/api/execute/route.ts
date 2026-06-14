import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeRateLimit } from "@/lib/ratelimit";
import { executeSchema } from "@/lib/validators";
import { executeCode, getLanguage } from "@/lib/execution";
import { db } from "@/lib/db";
import { executions } from "@/lib/db/schema";
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from "@/lib/constants";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Build a bootstrap snippet for languages that have an in-process package
 * manager. We inject this at the top of the first file so users can request
 * "packages" via the API without having to write install commands themselves.
 *
 * Returns null for languages that don't support runtime package install
 * (C/C++/Rust/Go/Java/Kotlin/Scala/HTML/CSS/SQL) — those need their toolchain
 * to handle packages upstream, which we don't do here.
 */
function buildPackageBootstrap(pistonLanguage: string, packages: string[]): string | null {
  if (packages.length === 0) return null;
  switch (pistonLanguage) {
    case "python": {
      const pyList = JSON.stringify(packages);
      return [
        "import subprocess, sys",
        `_pkgs = ${pyList}`,
        `_rc = subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", *_pkgs])`,
        "if _rc.returncode != 0:",
        '    print("pip install failed", file=sys.stderr)',
      ].join("\n");
    }
    case "javascript":
    case "typescript":
    case "node": {
      const jsList = JSON.stringify(packages);
      return [
        "const cp = require('node:child_process');",
        `const _pkgs = ${jsList};`,
        "const _rc = cp.spawnSync('npm', ['install', '--no-save', '--silent', ..._pkgs], { stdio: 'inherit' });",
        "if (_rc.status !== 0) console.error('npm install failed');",
      ].join("\n");
    }
    case "ruby": {
      const gemCommands = packages
        .map((p) => `system("gem install --no-document --user-install ${p}")`)
        .join("\n");
      return [gemCommands, "$LOAD_PATH.concat(Dir[File.join(Gem.user_dir, 'gems', '*', 'lib')])"].join("\n");
    }
    case "php": {
      const composerCmds = packages
        .map((p) => `passthru("composer require ${p} --no-interaction --no-progress 2>&1");`)
        .join("\n");
      // Emit our own <?php open tag so we're back in PHP mode before the
      // user's open tag closes/reopens. PHP only parses code inside open
      // tags, so any text outside is just echoed verbatim.
      return `<?php\n${composerCmds}\n?>`;
    }
    case "perl": {
      const perlPkgs = packages.map((p) => `"${p}"`).join(", ");
      return [
        `my @_pkgs = (${perlPkgs});`,
        `my $rc = system("cpanm --quiet --notest @_pkgs");`,
        `if ($rc != 0) { print STDERR "cpanm install failed\\n"; }`,
      ].join("\n");
    }
    default:
      return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const isAuthenticated = !!session?.user?.id;

  // Rate limiting: must have Redis configured; surface a 503 if not.
  try {
    const limiterOrPromise = executeRateLimit();
    const limiter = await limiterOrPromise;
    const limitKey = isAuthenticated ? `exec:${session.user.id}` : `exec:anon:${ip}`;
    const limit = await limiter(limitKey);
    if (!limit.success) {
      return NextResponse.json({ error: "rate_limited", retryAfter: limit.reset }, { status: 429 });
    }
  } catch (e) {
    // Redis missing -> backend is not available. Surface 503 so the
    // frontend knows the request cannot be served (no silent fallback).
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "backend_unavailable",
        component: "ratelimit",
        message: msg,
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "validation", message: "Request body must be valid JSON" },
      { status: 400 },
    );
  }
  const parsed = executeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { language, files, stdin, args, env } = parsed.data;
  const packages = parsed.data.packages ?? [];
  const limits = parsed.data.limits ?? {
    cpuTimeMs: 10_000,
    wallTimeMs: 30_000,
    memoryMB: 256,
    diskMB: 100,
    networkKB: 0,
    processes: 32,
  };
  const meta = getLanguage(language);
  if (!meta) {
    return NextResponse.json({ error: "invalid_language" }, { status: 400 });
  }

  const sessionId = nanoid(16);

  // Determine effective limits based on auth status
  const isPro = isAuthenticated && (session.user.role === "pro" || session.user.role === "admin");
  const tierLimits = isPro ? PRO_TIER_LIMITS : FREE_TIER_LIMITS;

  const effectiveLimits = {
    cpuTimeMs: Math.min(limits.cpuTimeMs, tierLimits.executionCpuSec * 1000),
    wallTimeMs:
      Math.min(limits.wallTimeMs, tierLimits.executionCpuSec * 1000 + 5000) +
      (packages.length > 0 ? 60_000 : 0),
    memoryMB: Math.min(limits.memoryMB, tierLimits.executionMemMB),
    diskMB: limits.diskMB,
    networkKB: limits.networkKB,
    processes: limits.processes,
  };

  const startTime = Date.now();

  // Prepend package installation for languages with package managers.
  // Each language has its own install command; we inject bootstrap code
  // into the first file so the user just requests packages via the API.
  const resolvedFiles = files.map((f, idx) => {
    if (idx !== 0 || packages.length === 0) return f;
    const bootstrap = buildPackageBootstrap(meta.pistonLanguage, packages);
    if (!bootstrap) return f;
    return { ...f, content: bootstrap + "\n" + f.content };
  });

  const result = await executeCode(
    {
      language: meta.pistonLanguage,
      version: parsed.data.version ?? meta.defaultVersion,
      files: resolvedFiles.map((f) => ({ name: f.name, content: f.content, encoding: f.encoding })),
      stdin,
      args,
      env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      compile_timeout: parsed.data.compileTimeoutMs,
      run_timeout: effectiveLimits.wallTimeMs,
    },
    effectiveLimits,
  );

  const durationMs = Date.now() - startTime;
  const finalResult = result.result;
  const compile = finalResult?.compile;
  const run = finalResult?.run;

  // Only persist execution history for authenticated users
  if (isAuthenticated) {
    try {
      await db.insert(executions).values({
        userId: session.user.id,
        sessionId,
        language,
        version: parsed.data.version ?? meta.defaultVersion,
        code: files[0]?.content ?? "",
        stdin,
        args,
        env,
        status: result.success && run?.code === 0 ? "completed" : "failed",
        exitCode: run?.code ?? compile?.code ?? null,
        stdout: run?.stdout ?? "",
        stderr: (run?.stderr ?? "") + (compile?.stderr ?? ""),
        cpuTimeMs: finalResult ? durationMs : null,
        wallTimeMs: durationMs,
        startedAt: new Date(startTime),
        finishedAt: new Date(),
      });
    } catch (e) {
      // DB write failure is non-critical for the response itself, but log it
      // so ops can investigate.
      console.error("execute_persist_failed", e);
    }
  }

  return NextResponse.json({
    sessionId,
    success: result.success,
    durationMs,
    result: {
      language: finalResult?.language ?? meta.pistonLanguage,
      version: finalResult?.version ?? parsed.data.version ?? meta.defaultVersion,
      run: run ?? null,
      compile: compile ?? null,
    },
    error: result.error,
    message: result.message,
  });
}
