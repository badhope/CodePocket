import { NextResponse } from "next/server";
import { listRuntimes } from "@/lib/execution";
import { redis } from "@/lib/storage/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cacheKey = "runtimes:list";
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, max-age=300" },
      });
    }
  }
  const runtimes = await listRuntimes();
  if (redis && runtimes.length > 0) {
    await redis.set(cacheKey, JSON.stringify(runtimes), { ex: 300 });
  }
  return NextResponse.json(runtimes, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
