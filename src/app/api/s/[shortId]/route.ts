// @ts-nocheck -- third-party types are incomplete
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { shares, projects, snippets } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  const url = new URL(req.url);
  const password = url.searchParams.get("password");

  const share = await db.query.shares.findFirst({
    where: eq(shares.shortId, shortId),
    with: {
      author: { columns: { id: true, name: true, image: true } },
    },
  });
  if (!share) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (share.burned) return NextResponse.json({ error: "burned" }, { status: 410 });
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  if (share.visibility === "password") {
    if (!password) return NextResponse.json({ error: "password_required" }, { status: 401 });
    if (!share.passwordHash) return NextResponse.json({ error: "invalid_share" }, { status: 500 });
    const ok = await bcrypt.compare(password, share.passwordHash);
    if (!ok) return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  let content: unknown = null;
  if (share.projectId) {
    const proj = await db.query.projects.findFirst({
      where: eq(projects.id, share.projectId),
      with: { files: true },
    });
    content = proj;
  } else if (share.snippetId) {
    const snip = await db.query.snippets.findFirst({ where: eq(snippets.id, share.snippetId) });
    content = snip;
  }

  await db
    .update(shares)
    .set({ viewCount: sql`${shares.viewCount} + 1` })
    .where(eq(shares.id, share.id));

  if (share.visibility === "burn_after_read") {
    await db.update(shares).set({ burned: true }).where(eq(shares.id, share.id));
  }

  return NextResponse.json({ share, content });
}
