import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function GET() {
  try {
    const file = await readFile(join(process.cwd(), "public", "manifest.json"), "utf8");
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600, must-revalidate",
      },
    });
  } catch {
    return new NextResponse("{}", { status: 404 });
  }
}
