import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, projectFiles } from "@/lib/db/schema";
import { createFileSchema } from "@/lib/validators";
import { apiRateLimit } from "@/lib/ratelimit";
import { FREE_TIER_LIMITS } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.ownerId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const files = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, id))
    .orderBy(asc(projectFiles.path));
  return NextResponse.json({ project, files });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = await apiRateLimit().limit(`files:create:${session.user.id}`);
  if (!limit.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { id } = await params;
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.ownerId, session.user.id)),
  });
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const count = await db.$count(projectFiles, eq(projectFiles.projectId, id));
  if (count >= FREE_TIER_LIMITS.filesPerProject) {
    return NextResponse.json({ error: "limit_exceeded" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createFileSchema.safeParse({ ...body, projectId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { path, type, content, encoding, mime } = parsed.data;

  try {
    const [created] = await db
      .insert(projectFiles)
      .values({
        projectId: id,
        path,
        type,
        content: content ?? "",
        encoding,
        mime: mime ?? "text/plain",
        size: content?.length ?? 0,
      })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message.includes("unique")) {
      return NextResponse.json({ error: "file_exists" }, { status: 409 });
    }
    throw e;
  }
}
