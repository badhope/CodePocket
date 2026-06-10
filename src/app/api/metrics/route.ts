import { NextResponse } from "next/server";
import { ConversionCache } from "@/lib/convert/cache";
import { success } from "@/lib/api/response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/metrics
 *
 * Lightweight, machine-friendly observability endpoint. Returns the
 * process-wide LRU cache statistics plus a fixed memory snapshot. The
 * response is intentionally stable and free of sensitive data so it is
 * safe to expose to internal monitoring agents.
 *
 * Consider putting this behind an auth check or IP allow-list in
 * production deployments.
 */
export async function GET() {
  const cache = ConversionCache.getInstance();
  const mem = process.memoryUsage();
  return NextResponse.json(
    success({
      cache: cache.stats,
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        rssMb: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
        heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
      },
      uptime: process.uptime(),
      node: process.version,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
