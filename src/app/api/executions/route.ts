import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { executions } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const limitN = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const rows = await db
    .select({
      id: executions.id,
      sessionId: executions.sessionId,
      language: executions.language,
      status: executions.status,
      exitCode: executions.exitCode,
      durationMs: executions.wallTimeMs,
      createdAt: executions.createdAt,
      codePreview: sql<string>`SUBSTRING(${executions.code}, 1, 200)`,
    })
    .from(executions)
    .where(eq(executions.userId, session.user.id))
    .orderBy(desc(executions.createdAt))
    .limit(limitN);
  return NextResponse.json({ items: rows });
}
