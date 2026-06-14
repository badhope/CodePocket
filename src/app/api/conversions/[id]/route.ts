import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { errors } from "@/lib/api/response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const { id } = await ctx.params;

  const existing = await db
    .select({ id: conversions.id })
    .from(conversions)
    .where(and(eq(conversions.id, id), eq(conversions.userId, session.user.id)))
    .limit(1);

  if (existing.length === 0) return errors.notFound("Conversion not found");

  await db.delete(conversions).where(and(eq(conversions.id, id), eq(conversions.userId, session.user.id)));

  return NextResponse.json({ success: true, id });
}
