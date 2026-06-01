import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { updateProjectSchema } from "@/lib/validators";
import { apiRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

async function getOwnedProject(id: string, userId: string) {
  return db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.ownerId, userId)),
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const p = await getOwnedProject(id, session.user.id);
  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const limit = await apiRateLimit().limit(`projects:patch:${session.user.id}`);
  if (!limit.success) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const { id } = await params;
  const existing = await getOwnedProject(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }

  const [updated] = await db
    .update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getOwnedProject(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await db.delete(projects).where(eq(projects.id, id));
  return NextResponse.json({ success: true });
}
