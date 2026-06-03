// @ts-nocheck
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { executeRateLimit } from "@/lib/ratelimit";
import { executeSchema } from "@/lib/validators";
import { executeCode, getLanguage } from "@/lib/execution";
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const encoder = new TextEncoder();
function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = await executeRateLimit().limit(`exec:sse:${session.user.id}`);
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
  if (!meta) return NextResponse.json({ error: "invalid_language" }, { status: 400 });

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
      files: files.map((f) => ({ name: f.name, content: f.content })),
      stdin,
      args,
      env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      compile_timeout: parsed.data.compileTimeoutMs,
      run_timeout: effectiveLimits.cpuTimeMs,
    },
    effectiveLimits,
  );

  const stream = new ReadableStream({
    start(controller) {
      try {
        controller.enqueue(sse("start", { ok: true }));
        if (result.result?.compile) {
          controller.enqueue(sse("compile", result.result.compile));
        }
        if (result.result?.run) {
          if (result.result.run.stdout)
            controller.enqueue(sse("stdout", { data: result.result.run.stdout }));
          if (result.result.run.stderr)
            controller.enqueue(sse("stderr", { data: result.result.run.stderr }));
        }
        controller.enqueue(
          sse("exit", {
            code: result.result?.run?.code ?? result.result?.compile?.code ?? -1,
            durationMs: Date.now() - startTime,
            success: result.success,
            error: result.error,
            message: result.message,
          }),
        );
        controller.close();
      } catch (e) {
        controller.enqueue(sse("error", { message: e instanceof Error ? e.message : String(e) }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
