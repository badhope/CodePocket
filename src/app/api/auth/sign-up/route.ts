import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signUpSchema } from "@/lib/validators";
import { authRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const limit = await authRateLimit().limit(`signup:${ip}`);
    if (!limit.success) {
      return NextResponse.json(
        { error: "rate_limited", retryAfter: limit.reset },
        { status: 429 },
      );
    }

    const body = await req.json();
    const parsed = signUpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { name, email, password, locale } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });
    if (existing) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = nanoid();

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        name,
        email: normalizedEmail,
        passwordHash,
        locale: locale ?? "en",
      });
    });

    return NextResponse.json({ id: userId, email: normalizedEmail }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "validation", issues: e.flatten() }, { status: 400 });
    }
    console.error("Sign up error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
