// @ts-nocheck -- third-party types are incomplete
import { NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectFiles } from "@/lib/db/schema";
import { createProjectSchema } from "@/lib/validators";
import { apiRateLimit } from "@/lib/ratelimit";
import { FREE_TIER_LIMITS, type Language } from "@/lib/constants";
import { getLanguage } from "@/lib/execution";

export const runtime = "nodejs";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 200) || nanoid(6)
  );
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = await apiRateLimit().limit(`projects:list:${session.user.id}`);
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const language = url.searchParams.get("language") as Language | null;
  const limitN = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);
  const cursor = url.searchParams.get("cursor");

  const conditions = [eq(projects.ownerId, session.user.id)];
  if (q) {
    conditions.push(or(ilike(projects.name, `%${q}%`), ilike(projects.description, `%${q}%`))!);
  }
  if (language && getLanguage(language)) {
    conditions.push(eq(projects.language, language));
  }
  if (cursor) {
    conditions.push(sql`${projects.updatedAt} < ${new Date(cursor)}`);
  }

  const rows = await db.query.projects.findMany({
    where: and(...conditions),
    orderBy: [desc(projects.updatedAt)],
    limit: limitN + 1,
    with: { files: { columns: { id: true } } },
  });

  const hasMore = rows.length > limitN;
  const items = hasMore ? rows.slice(0, limitN) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.updatedAt.toISOString() : null;

  return NextResponse.json({
    items: items.map((p) => ({
      ...p,
      fileCount: p.files.length,
      files: undefined,
    })),
    nextCursor,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = await apiRateLimit().limit(`projects:create:${session.user.id}`);
  if (!limit.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const count = await db.$count(projects, eq(projects.ownerId, session.user.id));
  if (count >= FREE_TIER_LIMITS.projects) {
    return NextResponse.json(
      { error: "limit_exceeded", message: `Free tier limited to ${FREE_TIER_LIMITS.projects} projects` },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { name, description, visibility, language, template } = parsed.data;
  const slug = (parsed.data.slug ?? slugify(name)) + "-" + nanoid(4);

  const meta = getLanguage(language);
  if (!meta) {
    return NextResponse.json({ error: "invalid_language" }, { status: 400 });
  }

  const [created] = await db
    .insert(projects)
    .values({
      ownerId: session.user.id,
      name,
      slug,
      description,
      visibility,
      language,
      template,
    })
    .returning();

  if (!created) {
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  const mainFile =
    language === "html"
      ? "index.html"
      : language === "cpp" || language === "c"
        ? "main." + (language === "cpp" ? "cpp" : "c")
        : "main." + (meta.extensions[0]?.replace(/^\./, "") ?? "txt");
  await db.insert(projectFiles).values({
    projectId: created.id,
    path: mainFile,
    type: "file",
    content: meta.defaultCode,
    mime: "text/plain",
    size: meta.defaultCode.length,
  });

  return NextResponse.json(created, { status: 201 });
}
