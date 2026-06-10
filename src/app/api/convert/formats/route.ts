import { NextRequest, NextResponse } from "next/server";
import { CONVERSION_MAP, INPUT_FORMATS, OUTPUT_FORMATS, MIME_TYPES } from "@/lib/convert";
import { MAX_FILE_SIZE_MB } from "@/lib/constants";
import { withCors, preflight } from "@/lib/api/cors";
import { checkRateLimit, DEFAULT_ROUTE_LIMITS } from "@/lib/api/ratelimit";
import { getClientIp } from "@/lib/api/log";

export const dynamic = "force-dynamic";

const FORMAT_DESCRIPTIONS: Record<
  string,
  {
    label: string;
    description: string;
    category: "document" | "spreadsheet" | "presentation" | "data" | "markup" | "text";
  }
> = {
  docx: { label: "Word Document", description: "Microsoft Word Open XML", category: "document" },
  pdf: { label: "PDF", description: "Portable Document Format", category: "document" },
  md: { label: "Markdown", description: "Plain-text markup", category: "markup" },
  html: { label: "HTML", description: "HyperText Markup Language", category: "markup" },
  txt: { label: "Plain Text", description: "Unformatted text", category: "text" },
  xlsx: { label: "Excel Spreadsheet", description: "Microsoft Excel Open XML", category: "spreadsheet" },
  csv: { label: "CSV", description: "Comma-separated values", category: "data" },
  json: { label: "JSON", description: "JavaScript Object Notation", category: "data" },
  xml: { label: "XML", description: "Extensible Markup Language", category: "markup" },
  pptx: {
    label: "PowerPoint Presentation",
    description: "Microsoft PowerPoint Open XML",
    category: "presentation",
  },
};

const DEFAULT_DESC = { label: "", description: "", category: "text" as const };

function buildFormats() {
  const inputMeta = INPUT_FORMATS.map((id) => {
    const d = FORMAT_DESCRIPTIONS[id] ?? DEFAULT_DESC;
    return {
      id,
      label: d.label,
      description: d.description,
      category: d.category,
      mimeType: MIME_TYPES[id] ?? "application/octet-stream",
      maxFileSizeMB: MAX_FILE_SIZE_MB,
    };
  });
  const outputMeta = OUTPUT_FORMATS.map((id) => {
    const d = FORMAT_DESCRIPTIONS[id] ?? DEFAULT_DESC;
    return {
      id,
      label: d.label,
      description: d.description,
      category: d.category,
      mimeType: MIME_TYPES[id] ?? "application/octet-stream",
    };
  });
  return {
    // Backward-compatible top-level arrays.
    inputFormats: INPUT_FORMATS,
    outputFormats: OUTPUT_FORMATS,
    conversionMap: CONVERSION_MAP,
    mimeTypes: MIME_TYPES,
    // New structured metadata.
    inputFormatMeta: inputMeta,
    outputFormatMeta: outputMeta,
    maxFileSizeMB: MAX_FILE_SIZE_MB,
  };
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const ip = getClientIp(req);

  // Light rate limit so a misbehaving client cannot drain the cache.
  const rl = await checkRateLimit(
    { method: "GET", path: "/api/convert/formats", ip },
    { routes: DEFAULT_ROUTE_LIMITS },
  );

  const data = buildFormats();
  const cacheControl = rl.success
    ? "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"
    : "public, max-age=60, s-maxage=60, stale-while-revalidate=600";

  const response = NextResponse.json(data, {
    status: 200,
    headers: {
      "Cache-Control": cacheControl,
      "CDN-Cache-Control": "public, max-age=3600",
      Vary: "Origin, Accept-Encoding",
    },
  });
  return withCors(response, origin);
}

export function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"), {
    allowedMethods: ["GET", "OPTIONS"],
  });
}
