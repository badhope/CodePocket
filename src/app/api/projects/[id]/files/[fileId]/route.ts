// @ts-nocheck -- third-party types are incomplete
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectFiles, fileVersions } from "@/lib/db/schema";
import { updateFileSchema } from "@/lib/validators";
import { apiRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

async function findFile(projectId: string, fileId: string, userId: string) {
  const proj = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });
  if (!proj) return null;
  return db.query.projectFiles.findFirst({
    where: and(eq(projectFiles.id, fileId), eq(projectFiles.projectId, projectId)),
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, fileId } = await params;
  const f = await findFile(id, fileId, session.user.id);
  if (!f) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(f);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = await apiRateLimit().limit(`files:patch:${session.user.id}`);
  if (!limit.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { id, fileId } = await params;
  const f = await findFile(id, fileId, session.user.id);
  if (!f) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateFileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { content, commitMessage } = parsed.data;
  if (content === undefined) return NextResponse.json({ error: "no_changes" }, { status: 400 });

  await db.transaction(async (tx) => {
    if (f.content !== null && f.content !== content) {
      await tx.insert(fileVersions).values({
        fileId: f.id,
        blobKey: f.blobKey ?? `inline:${f.id}:${Date.now()}`,
        size: f.size,
        commitMessage: commitMessage ?? "Auto-save",
        authorId: session.user.id,
      });
    }
    await tx
      .update(projectFiles)
      .set({ content, size: content.length, updatedAt: new Date() })
      .where(eq(projectFiles.id, fileId));
  });

  const updated = await db.query.projectFiles.findFirst({ where: eq(projectFiles.id, fileId) });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, fileId } = await params;
  const f = await findFile(id, fileId, session.user.id);
  if (!f) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.delete(projectFiles).where(eq(projectFiles.id, fileId));
  return NextResponse.json({ success: true });
}
