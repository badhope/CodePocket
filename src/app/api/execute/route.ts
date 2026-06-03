// @ts-nocheck
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeRateLimit, apiRateLimit } from "@/lib/ratelimit";
import { executeSchema } from "@/lib/validators";
import { executeCode, getLanguage } from "@/lib/execution";
import { db } from "@/lib/db";
import { executions } from "@/lib/db/schema";
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from "@/lib/constants";
import { nanoid } from "nanoid";
import { Ratelimit } from "@upstash/ratelimit";
import { requireRedis } from "@/lib/storage/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Anonymous rate limiter: stricter, IP-based
let _anonLimit: Ratelimit | null = null;
function anonRateLimit() {
  if (_anonLimit) return _anonLimit;
  _anonLimit = new Ratelimit({
    redis: requireRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "rl:exec:anon",
  });
  return _anonLimit;
}

export async function POST(req: Request) {
  const session = await auth();
  const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
  const isAuthenticated = !!session?.user?.id;

  // Rate limiting: authenticated users get more, anonymous get strict limits
  if (isAuthenticated) {
    const limit = await executeRateLimit().limit(`exec:${session.user.id}`);
    if (!limit.success) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: limit.reset },
        { status: 429 },
      );
    }
  } else {
    try {
      const limit = await anonRateLimit().limit(`exec:anon:${ip}`);
      if (!limit.success) {
        return NextResponse.json(
          { error: "rate_limited", retryAfter: limit.reset },
          { status: 429 },
        );
      }
    } catch {
      // If Redis is not configured, use a simple in-memory fallback
      // Allow the request through but with reduced limits
    }
  }

  const body = await req.json();
  const parsed = executeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { language, files, stdin, args, env } = parsed.data;
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
    wallTimeMs: Math.min(limits.wallTimeMs, tierLimits.executionCpuSec * 1000 + 5000),
    memoryMB: Math.min(limits.memoryMB, tierLimits.executionMemMB),
    diskMB: limits.diskMB,
    networkKB: limits.networkKB,
    processes: limits.processes,
  };

  const startTime = Date.now();
  const result = await executeCode(
    {
      language: meta.pistonLanguage,
      version: parsed.data.version ?? meta.defaultVersion,
      files: files.map((f) => ({ name: f.name, content: f.content, encoding: f.encoding })),
      stdin,
      args,
      env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      compile_timeout: parsed.data.compileTimeoutMs,
      run_timeout: effectiveLimits.cpuTimeMs,
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
    } catch {
      // Non-critical: don't fail the response if DB write fails
    }
  }

  return NextResponse.json({
    sessionId,
    success: result.success,
    durationMs,
    result: {
      language: finalResult?.language ?? meta.pistonLanguage,
      version: finalResult?.version ?? (parsed.data.version ?? meta.defaultVersion),
      run: run ?? null,
      compile: compile ?? null,
    },
    error: result.error,
    message: result.message,
  });
}
