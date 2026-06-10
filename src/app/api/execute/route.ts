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
