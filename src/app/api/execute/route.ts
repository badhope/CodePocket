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
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = await executeRateLimit().limit(`exec:${session.user.id}`);
  if (!limit.success) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: limit.reset },
      { status: 429 },
    );
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
  const isPro = session.user.role === "pro" || session.user.role === "admin";
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

  await db.insert(executions).values({
    userId: session.user.id,
    sessionId,
    language,
    version: parsed.data.version ?? meta.defaultVersion,
    code: files[0]?.content ?? "",
    stdin,
    args,
    env,
    status: result.success && (run?.code === 0) ? "completed" : "failed",
    exitCode: run?.code ?? compile?.code ?? null,
    stdout: run?.stdout ?? "",
    stderr: (run?.stderr ?? "") + (compile?.stderr ?? ""),
    cpuTimeMs: finalResult ? durationMs : null,
    wallTimeMs: durationMs,
    startedAt: new Date(startTime),
    finishedAt: new Date(),
  });

  return NextResponse.json({
    sessionId,
    success: result.success,
    durationMs,
    compile: compile ?? null,
    run: run ?? null,
    error: result.error,
    message: result.message,
  });
}
