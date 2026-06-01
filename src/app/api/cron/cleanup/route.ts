import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shares, executions } from "@/lib/db/schema";
import { and, lt, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  const authz = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authz !== `Bearer ${cronSecret}`) return unauthorized();

  const now = new Date();
  const expiredShares = await db
    .delete(shares)
    .where(and(lt(shares.expiresAt, now), sql`${shares.expiresAt} IS NOT NULL`))
    .returning({ id: shares.id });

  const oldExecutions = await db
    .delete(executions)
    .where(lt(executions.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)))
    .returning({ id: executions.id });

  return NextResponse.json({
    ok: true,
    deletedShares: expiredShares.length,
    deletedExecutions: oldExecutions.length,
    timestamp: now.toISOString(),
  });
}
