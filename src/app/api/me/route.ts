import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

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
