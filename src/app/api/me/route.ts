import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const runtime = "nodejs";

const updateMeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  locale: z.string().min(2).max(10).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ user: null });
  }
  const u = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      locale: true,
      theme: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ user: u ?? null });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }
  const [updated] = await db
    .update(users)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(users.id, session.user.id))
    .returning();
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { passwordHash: _ph, ...safe } = updated;
  void _ph;
  return NextResponse.json({ user: safe });
}
