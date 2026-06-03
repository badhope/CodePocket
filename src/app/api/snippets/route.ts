// @ts-nocheck
import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { snippets } from "@/lib/db/schema";
import { createSnippetSchema } from "@/lib/validators";
import { apiRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = await apiRateLimit().limit(`snippets:list:${session.user.id}`);
  if (!limit.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const language = url.searchParams.get("language");
  const tag = url.searchParams.get("tag");
  const limitN = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const cursor = url.searchParams.get("cursor");

  const conditions = [eq(snippets.authorId, session.user.id)];
  if (q) conditions.push(or(ilike(snippets.title, `%${q}%`), ilike(snippets.code, `%${q}%`))!);
  if (language) conditions.push(eq(snippets.language, language));
  if (cursor) conditions.push(sql`${snippets.updatedAt} < ${new Date(cursor)}`);
  if (tag) conditions.push(sql`${snippets.tags} @> ${JSON.stringify([tag])}::jsonb`);

  const rows = await db.query.snippets.findMany({
    where: and(...conditions),
    orderBy: [desc(snippets.updatedAt)],
    limit: limitN + 1,
  });

  const hasMore = rows.length > limitN;
  const items = hasMore ? rows.slice(0, limitN) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.updatedAt.toISOString() : null;
  return NextResponse.json({ items, nextCursor });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = await apiRateLimit().limit(`snippets:create:${session.user.id}`);
  if (!limit.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const body = await req.json();
  const parsed = createSnippetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { title, description, language, code, tags, visibility } = parsed.data;
  const [created] = await db
    .insert(snippets)
    .values({ authorId: session.user.id, title, description, language, code, tags, visibility })
    .returning();
  return NextResponse.json(created, { status: 201 });
}
