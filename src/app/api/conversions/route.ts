import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { success, errors } from "@/lib/api/response";

const deleteSchema = z.object({
  confirm: z.literal("DELETE_ALL"),
});

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  let body: unknown = null;
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    // Empty body is OK
  }

  if (body) {
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) return errors.badRequest("Missing confirm: DELETE_ALL");
  }

  const result = await db
    .delete(conversions)
    .where(eq(conversions.userId, session.user.id))
    .returning({ id: conversions.id });

  return success({ count: result.length });
}
