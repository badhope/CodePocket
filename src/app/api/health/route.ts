import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { redis } from "@/lib/storage/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const startTime = Date.now();

export async function GET() {
  const checks: Record<string, { status: "up" | "down"; latencyMs?: number; error?: string }> = {};

  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "up", latencyMs: Date.now() - dbStart };
  } catch (e) {
    checks.database = { status: "down", error: e instanceof Error ? e.message : String(e) };
  }

  const redisStart = Date.now();
  try {
    if (redis) {
      await redis.ping();
      checks.redis = { status: "up", latencyMs: Date.now() - redisStart };
    } else {
      checks.redis = { status: "down", error: "not configured" };
    }
  } catch (e) {
    checks.redis = { status: "down", error: e instanceof Error ? e.message : String(e) };
  }

  const allUp = Object.values(checks).every((c) => c.status === "up");
  return NextResponse.json(
    {
      status: allUp ? "ok" : "degraded",
      uptimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allUp ? 200 : 503 },
  );
}
