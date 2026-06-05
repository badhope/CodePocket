import { NextResponse } from "next/server";
import { listRuntimes } from "@/lib/execution";
import { backend, upstash, local } from "@/lib/storage/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_SECONDS = 300;
const cacheKey = "runtimes:list";

/**
 * GET /api/runtimes - list available Piston runtimes.
 *
 * The result is cached in Redis for 5 minutes when a backend is configured.
 * If no backend is available we serve the list directly (the call to Piston is
 * a single GET, so the cache is a nice-to-have, not a requirement).
 */
export async function GET() {
  const cache = backend() === "upstash" ? upstash : backend() === "local" ? local : null;
  if (cache) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        const body = typeof cached === "string" ? cached : JSON.stringify(cached);
        return new NextResponse(body, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
          },
        });
      }
    } catch (err) {
      console.warn("[runtimes] cache read failed", err);
    }
  }

  const runtimes = await listRuntimes();

  if (cache && runtimes.length > 0) {
    try {
      await cache.set(cacheKey, JSON.stringify(runtimes), "EX", CACHE_TTL_SECONDS);
    } catch (err) {
      console.warn("[runtimes] cache write failed", err);
    }
  }

  return NextResponse.json(runtimes, {
    headers: { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` },
  });
}
