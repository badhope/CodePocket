import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthCheck {
  name: string;
  status: "ok" | "degraded" | "down";
  detail?: string;
  durationMs: number;
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Lazy import so health checks do not crash the process if the
    // database module is misconfigured. We exercise a no-op query.
    const { db } = await import("@/lib/db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    return {
      name: "database",
      status: "ok",
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      name: "database",
      status: "down",
      detail: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - start,
    };
  }
}

async function checkCache(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { ConversionCache } = await import("@/lib/convert/cache");
    const cache = ConversionCache.getInstance();
    const stats = cache.stats;
    if (stats.maxSize === 0) {
      return { name: "cache", status: "degraded", detail: "max size is 0", durationMs: Date.now() - start };
    }
    return {
      name: "cache",
      status: "ok",
      detail: `${stats.size}/${stats.maxSize} entries`,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      name: "cache",
      status: "down",
      detail: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - start,
    };
  }
}

function checkMemory(): HealthCheck {
  const start = Date.now();
  const mem = process.memoryUsage();
  const heapUsedMb = mem.heapUsed / (1024 * 1024);
  // Heuristic: 512MB heap pressure signals a leak risk. We surface
  // "degraded" so monitoring can alert without taking the pod out.
  const status: HealthCheck["status"] = heapUsedMb > 512 ? "degraded" : "ok";
  return {
    name: "memory",
    status,
    detail: `${Math.round(heapUsedMb)}MB heap used`,
    durationMs: Date.now() - start,
  };
}

export async function GET() {
  const [database, cache, memory] = await Promise.all([
    checkDatabase(),
    checkCache(),
    Promise.resolve(checkMemory()),
  ]);
  const checks = { database, cache, memory };
  const overall: HealthCheck["status"] = Object.values(checks).some((c) => c.status === "down")
    ? "down"
    : Object.values(checks).some((c) => c.status === "degraded")
      ? "degraded"
      : "ok";

  const body = {
    status: overall,
    version: APP_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  };

  return NextResponse.json(body, {
    status: overall === "down" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
