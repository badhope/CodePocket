import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { snippets, projects, shares } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { z } from "zod";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const createShareSchema = z.object({
  projectId: z.string().uuid().optional(),
  snippetId: z.string().uuid().optional(),
  visibility: z.enum(["public", "password", "burn_after_read"]).default("public"),
  password: z.string().min(4).max(128).optional(),
  expiresIn: z.number().int().min(0).max(2_592_000).default(2_592_000),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const snippetId = url.searchParams.get("snippetId");
  if (!projectId && !snippetId) {
    return NextResponse.json({ error: "missing_target" }, { status: 400 });
  }
  const rows = await db
    .select()
    .from(shares)
    .where(
      and(
        eq(shares.authorId, session.user.id),
        projectId ? eq(shares.projectId, projectId) : eq(shares.snippetId, snippetId!),
      ),
    )
    .orderBy(desc(shares.createdAt))
    .limit(100);
  return NextResponse.json({ shares: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.projectId && !parsed.data.snippetId) {
    return NextResponse.json({ error: "missing_target" }, { status: 400 });
  }

  if (parsed.data.projectId) {
    const proj = await db.query.projects.findFirst({
      where: and(eq(projects.id, parsed.data.projectId), eq(projects.ownerId, session.user.id)),
    });
    if (!proj) return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (parsed.data.snippetId) {
    const snip = await db.query.snippets.findFirst({
      where: and(eq(snippets.id, parsed.data.snippetId), eq(snippets.authorId, session.user.id)),
    });
    if (!snip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const shortId = nanoid(10);
  const passwordHash = parsed.data.password
    ? await bcrypt.hash(parsed.data.password, 10)
    : null;

  const expiresAt =
    parsed.data.expiresIn > 0 ? new Date(Date.now() + parsed.data.expiresIn * 1000) : null;

  const [created] = await db
    .insert(shares)
    .values({
      shortId,
      authorId: session.user.id,
      projectId: parsed.data.projectId,
      snippetId: parsed.data.snippetId,
      visibility: parsed.data.visibility,
      passwordHash,
      expiresAt,
    })
    .returning();

  if (!created) return NextResponse.json({ error: "create_failed" }, { status: 500 });

  return NextResponse.json(
    { shortId, url: `/s/${shortId}`, expiresAt: created.expiresAt },
    { status: 201 },
  );
}
