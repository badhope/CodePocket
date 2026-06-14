import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  convert,
  detectFormat,
  getOutputFilename,
  isConversionSupported,
  INPUT_FORMATS,
  OUTPUT_FORMATS,
  type InputFormat,
  type OutputFormat,
} from "@/lib/convert";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { conversions, documents } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { checkRateLimit, DEFAULT_ROUTE_LIMITS } from "@/lib/api/ratelimit";
import { preflight, withCors } from "@/lib/api/cors";
import { errors, validationError } from "@/lib/api/response";
import { getClientIp, logger, newRequestId } from "@/lib/api/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const outputFormatSchema = z.enum(OUTPUT_FORMATS);

const formSchema = z.object({
  file: z.instanceof(File).refine((f) => f.size > 0, "File is empty"),
  outputFormat: outputFormatSchema,
});

// Allow plenty of headroom for the per-format max file size validation.
const ABSOLUTE_MAX_BYTES = Math.max(MAX_FILE_SIZE_BYTES, 100 * 1024 * 1024);

// ---------------------------------------------------------------------------
// Magic-number validation
// ---------------------------------------------------------------------------

/**
 * Map of InputFormat -> list of accepted magic bytes (hex). The first N bytes
 * of the uploaded file must match one of the entries exactly. This stops
 * trivial attacks where a user renames `evil.pdf` to `evil.docx`.
 */
const MAGIC_BYTES: Record<InputFormat, Uint8Array[]> = {
  pdf: [new Uint8Array([0x25, 0x50, 0x44, 0x46])], // %PDF
  docx: [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // PKZip
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // empty PKZip
    new Uint8Array([0x50, 0x4b, 0x07, 0x08]), // spanned PKZip
  ],
  xlsx: [new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
  pptx: [new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
  md: [],
  html: [],
  txt: [],
  csv: [],
  json: [],
  xml: [],
};

function bytesStartWith(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0) return true;
  if (haystack.length < needle.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (haystack[i] !== needle[i]) return false;
  }
  return true;
}

function validateMagicBytes(format: InputFormat, head: Uint8Array): boolean {
  const candidates = MAGIC_BYTES[format];
  if (!candidates || candidates.length === 0) return true;
  return candidates.some((c) => bytesStartWith(head, c));
}

// ---------------------------------------------------------------------------
// CORS preflight
// ---------------------------------------------------------------------------

export function OPTIONS(req: NextRequest) {
  return preflight(req.headers.get("origin"), {
    allowedMethods: ["POST", "OPTIONS"],
  });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  const ip = getClientIp(req);
  const origin = req.headers.get("origin");

  // Run rate limits before doing any heavy work.
  const rl = await checkRateLimit(
    { method: "POST", path: "/api/convert", ip },
    { routes: DEFAULT_ROUTE_LIMITS },
  );
  if (!rl.success) {
    const logCtx = logger.withContext({ requestId, ip, path: "/api/convert", method: "POST" });
    if (rl.scope === "unconfigured") {
      logCtx.error("rate_limit_backend_unavailable", { reason: "no_redis_backend" });
      return withCors(
        errors.serviceUnavailable(
          "Redis backend not configured. Set UPSTASH_REDIS_REST_URL/TOKEN or REDIS_URL.",
        ),
        origin,
      );
    }
    logCtx.warn("convert_rate_limited", { scope: rl.scope, retryAfterMs: rl.retryAfterMs });
    return withCors(errors.rateLimited(Math.ceil(rl.retryAfterMs / 1000)), origin);
  }

  const log = logger.withContext({ requestId, ip, path: "/api/convert", method: "POST" });
  const startTime = Date.now();

  try {
    const session = await auth();
    const userId = session?.user?.id;

    // Authenticated users get a second, higher cap.
    if (userId) {
      const userRl = await checkRateLimit(
        { method: "POST", path: "/api/convert", ip, userId },
        { routes: DEFAULT_ROUTE_LIMITS },
      );
      if (!userRl.success) {
        if (userRl.scope === "unconfigured") {
          log.error("rate_limit_backend_unavailable", { reason: "no_redis_backend", userId });
          return withCors(
            errors.serviceUnavailable(
              "Redis backend not configured. Set UPSTASH_REDIS_REST_URL/TOKEN or REDIS_URL.",
            ),
            origin,
          );
        }
        log.warn("convert_user_rate_limited", { userId, retryAfterMs: userRl.retryAfterMs });
        return withCors(errors.rateLimited(Math.ceil(userRl.retryAfterMs / 1000)), origin);
      }
    }

    const formData = await req.formData();
    const rawFile = formData.get("file");
    const rawFormat = formData.get("outputFormat");

    if (!(rawFile instanceof File)) {
      log.warn("convert_missing_file", { userId });
      return withCors(errors.badRequest("Missing file"), origin);
    }
    if (typeof rawFormat !== "string") {
      log.warn("convert_missing_format", { userId });
      return withCors(errors.badRequest("Missing outputFormat"), origin);
    }

    const parsed = formSchema.safeParse({ file: rawFile, outputFormat: rawFormat });
    if (!parsed.success) {
      log.warn("convert_validation_failed", { issues: parsed.error.flatten().fieldErrors });
      return withCors(validationError(parsed.error), origin);
    }

    const { file, outputFormat } = parsed.data;
    const outputFormatTyped: OutputFormat = outputFormat;

    if (file.size > ABSOLUTE_MAX_BYTES) {
      log.warn("convert_file_too_large", { size: file.size, userId });
      return withCors(errors.payloadTooLarge(`File too large. Max ${MAX_FILE_SIZE_MB}MB`), origin);
    }

    const inputFormat = detectFormat(file.name);
    if (!inputFormat) {
      log.warn("convert_unsupported_input", { filename: file.name, userId });
      return withCors(errors.badRequest("Unsupported input format"), origin);
    }

    if (!INPUT_FORMATS.includes(inputFormat as (typeof INPUT_FORMATS)[number])) {
      log.warn("convert_invalid_input_format", { inputFormat, userId });
      return withCors(errors.badRequest(`Invalid input format: ${inputFormat}`), origin);
    }

    if (!isConversionSupported(inputFormat, outputFormatTyped)) {
      log.warn("convert_unsupported_conversion", { inputFormat, outputFormat, userId });
      return withCors(
        errors.badRequest(`Conversion from ${inputFormat} to ${outputFormat} is not supported`),
        origin,
      );
    }

    // Read the bytes once, then run the magic-number check on a slice.
    const buffer = Buffer.from(await file.arrayBuffer());
    const head = new Uint8Array(buffer.buffer, buffer.byteOffset, Math.min(buffer.byteLength, 16));
    if (!validateMagicBytes(inputFormat, head)) {
      log.warn("convert_magic_bytes_mismatch", {
        inputFormat,
        filename: file.name,
        userId,
      });
      return withCors(
        errors.badRequest(`File contents do not match the declared ${inputFormat} format`),
        origin,
      );
    }

    let result;
    try {
      result = await convert(buffer, {
        inputFormat,
        outputFormat: outputFormatTyped,
        filename: file.name,
      });
    } catch (err) {
      log.error("convert_engine_throw", { inputFormat, outputFormat, userId }, err);
      return withCors(errors.internal("Conversion engine failed"), origin);
    }

    if (!result.success || !result.outputBuffer) {
      log.warn("convert_engine_failed", {
        inputFormat,
        outputFormat,
        error: result.error,
        userId,
      });
      return withCors(errors.internal(result.error ?? "Conversion failed"), origin);
    }

    const outputFilename = result.outputFilename || getOutputFilename(file.name, outputFormatTyped);
    const durationMs = Date.now() - startTime;

    log.info("convert_success", {
      inputFormat,
      outputFormat,
      size: file.size,
      outputSize: result.outputBuffer.length,
      durationMs,
      userId,
    });

    // Persist a conversion record (and document) for logged-in users.
    if (userId) {
      try {
        const documentId = await db.transaction(async (tx) => {
          const [doc] = await tx
            .insert(documents)
            .values({
              id: crypto.randomUUID(),
              userId,
              filename: file.name.slice(0, 255),
              originalName: file.name.slice(0, 255),
              format: inputFormat,
              size: file.size,
              mimeType: file.type || "application/octet-stream",
              status: "uploaded",
            })
            .returning({ id: documents.id });
          if (!doc) throw new Error("document_insert_failed");
          await tx.insert(conversions).values({
            id: nanoid(),
            userId,
            documentId: doc.id,
            inputFormat,
            outputFormat,
            status: "completed",
            progress: 100,
            outputSize: result.outputBuffer?.length ?? 0,
            outputFilename: outputFilename.slice(0, 255),
            durationMs,
            completedAt: new Date(),
          });
          return doc.id;
        });
        void documentId;
      } catch (err) {
        // Persistence is best-effort - never fail the user-visible response
        // because of a DB hiccup, but record it for ops.
        log.error("convert_persist_failed", { userId }, err);
      }
    }

    const body = new Uint8Array(
      result.outputBuffer.buffer,
      result.outputBuffer.byteOffset,
      result.outputBuffer.byteLength,
    );
    const response = new NextResponse(body as unknown as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${outputFilename}"`,
        "Content-Length": String(result.outputBuffer.length),
        "Cache-Control": "private, no-store",
        "X-Request-Id": requestId,
      },
    });
    return withCors(response, origin);
  } catch (error) {
    log.error("convert_unhandled", undefined, error);
    return withCors(errors.internal("Internal server error"), origin);
  }
}
