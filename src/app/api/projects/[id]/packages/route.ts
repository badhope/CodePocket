// @ts-nocheck -- third-party types are incomplete
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { packages, projects } from "@/lib/db/schema";

export const runtime = "nodejs";

const addPackageSchema = z.object({
  ecosystem: z.enum(["npm", "pip", "cargo", "maven", "gem", "go"]),
  name: z
    .string()
    .min(1)
    .max(128)
    .regex(/^(@?[a-z0-9][a-z0-9._/-]*[a-z0-9]|[a-z0-9]+)$/i, "invalid package name"),
  version: z.string().max(64).optional(),
  dev: z.boolean().default(false),
});

const removePackageSchema = z.object({
  ecosystem: z.enum(["npm", "pip", "cargo", "maven", "gem", "go"]),
  name: z.string().min(1).max(128),
});

async function assertProjectOwnership(projectId: string, userId: string) {
  const proj = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });
  return proj;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const proj = await assertProjectOwnership(id, session.user.id);
  if (!proj) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rows = await db
    .select()
    .from(packages)
    .where(eq(packages.projectId, id));
  return NextResponse.json({ packages: rows });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const proj = await assertProjectOwnership(id, session.user.id);
  if (!proj) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json();
  const parsed = addPackageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const [created] = await db
    .insert(packages)
    .values({
      projectId: id,
      ecosystem: parsed.data.ecosystem,
      name: parsed.data.name,
      version: parsed.data.version ?? null,
      dev: parsed.data.dev,
    })
    .onConflictDoUpdate({
      target: [packages.projectId, packages.ecosystem, packages.name],
      set: { version: parsed.data.version ?? null, dev: parsed.data.dev },
    })
    .returning();
  if (!created) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json({ package: created }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const proj = await assertProjectOwnership(id, session.user.id);
  if (!proj) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = await req.json();
  const parsed = removePackageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await db
    .delete(packages)
    .where(
      and(
        eq(packages.projectId, id),
        eq(packages.ecosystem, parsed.data.ecosystem),
        eq(packages.name, parsed.data.name),
      ),
    )
    .returning({ id: packages.id });
  if (result.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
