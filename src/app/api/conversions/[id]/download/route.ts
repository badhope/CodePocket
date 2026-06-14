import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getMimeType } from "@/lib/convert";
import { errors } from "@/lib/api/response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();

  const { id } = await ctx.params;

  const record = await db
    .select()
    .from(conversions)
    .where(and(eq(conversions.id, id), eq(conversions.userId, session.user.id)))
    .limit(1);

  if (record.length === 0) return errors.notFound("Conversion not found");

  const c = record[0]!;
  if (c.status !== "completed" || !c.outputFilename) {
    return errors.badRequest("Conversion is not ready for download");
  }

  if (!c.outputBlobKey) {
    return new NextResponse(
      JSON.stringify({
        message: "Output not stored. This conversion was performed in legacy mode.",
        outputFilename: c.outputFilename,
      }),
      { status: 410, headers: { "Content-Type": "application/json" } },
    );
  }

  return new NextResponse(
    JSON.stringify({
      message: "Download via blob URL",
      outputFilename: c.outputFilename,
      outputBlobKey: c.outputBlobKey,
      mimeType: getMimeType(c.outputFormat),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=0, no-cache",
      },
    },
  );
}
