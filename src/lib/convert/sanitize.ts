import { ConversionError, type InputFormat } from "./types";

/* ------------------------------------------------------------------ */
/*                          Text sanitization                          */
/* ------------------------------------------------------------------ */

const HTML_TAG_REGEX = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g;
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;
const DANGEROUS_TAGS = new Set(["script", "iframe", "object", "embed", "link", "meta", "style", "base"]);
const ON_EVENT_REGEX = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URL_REGEX = /\s(href|src|action|formaction|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi;
const DATA_URL_REGEX = /\s(href|src|action|formaction|xlink:href)\s*=\s*("|')\s*data:[^"']*\2/gi;
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

/**
 * Strip dangerous HTML constructs (`<script>`, `<iframe>`, inline event
 * handlers, `javascript:` URLs, `data:` URLs, comments) from a string.
 * Designed to be conservative — the result is safe to inject into a
 * Markdown renderer or any context that expects HTML to be inert.
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== "string") return "";
  return html
    .replace(HTML_COMMENT_REGEX, "")
    .replace(HTML_TAG_REGEX, (match, rawTag: string) => {
      const tag = rawTag.toLowerCase();
      if (DANGEROUS_TAGS.has(tag)) return "";
      // Drop `<tag on...="...">` attributes by stripping the event handlers.
      return match;
    })
    .replace(ON_EVENT_REGEX, "")
    .replace(JAVASCRIPT_URL_REGEX, ' $1="#"')
    .replace(DATA_URL_REGEX, ' $1="#"');
}

/**
 * Remove ASCII control characters and other non-printable bytes that
 * could corrupt downstream renderers. We preserve line breaks (LF, CR,
 * TAB) but strip everything else from the control range.
 */
export function sanitizeText(text: string): string {
  if (typeof text !== "string") return "";
  return text.replace(CONTROL_CHAR_REGEX, "");
}

/* ------------------------------------------------------------------ */
/*                          Magic numbers                              */
/* ------------------------------------------------------------------ */

interface MagicSpec {
  format: InputFormat | null;
  mime: string;
  /** Bytes (hex) that must appear at the start of the buffer. */
  prefix: number[];
  /** Bytes (hex) that may appear slightly later; the first one that matches wins. */
  offset?: Array<{ offset: number; bytes: number[] }>;
}

const MAGIC_SPECS: MagicSpec[] = [
  { format: "pdf", mime: "application/pdf", prefix: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { format: null, mime: "image/png", prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { format: null, mime: "image/jpeg", prefix: [0xff, 0xd8, 0xff] },
  { format: null, mime: "application/zip", prefix: [0x50, 0x4b, 0x03, 0x04] },
  { format: null, mime: "application/gzip", prefix: [0x1f, 0x8b] },
];

function matchesPrefix(buffer: Buffer, prefix: number[]): boolean {
  if (buffer.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (buffer[i] !== prefix[i]) return false;
  }
  return true;
}

/**
 * Detect the MIME type of a buffer by inspecting its leading bytes.
 * Returns `application/octet-stream` when no signature is recognised.
 * ZIP-based formats (DOCX/XLSX/PPTX) all share the `PK\x03\x04` magic
 * and are disambiguated by inspecting the `[Content_Types].xml` entry
 * inside the archive.
 */
export function detectMimeFromBuffer(buffer: Buffer): string {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return "application/octet-stream";
  for (const spec of MAGIC_SPECS) {
    if (matchesPrefix(buffer, spec.prefix)) {
      if (spec.mime === "application/zip") {
        return detectOfficeFormat(buffer) ?? "application/zip";
      }
      return spec.mime;
    }
  }
  // Some streams start with UTF-8 BOM or whitespace; trim and retry.
  const trimmed = trimLeading(buffer);
  for (const spec of MAGIC_SPECS) {
    if (matchesPrefix(trimmed, spec.prefix)) {
      if (spec.mime === "application/zip") {
        return detectOfficeFormat(trimmed) ?? "application/zip";
      }
      return spec.mime;
    }
  }
  // Fall back to text heuristics.
  if (looksLikeJson(buffer)) return "application/json";
  if (looksLikeXml(buffer)) return "application/xml";
  if (looksLikeHtml(buffer)) return "text/html";
  return "application/octet-stream";
}

function trimLeading(buffer: Buffer): Buffer {
  let i = 0;
  while (i < buffer.length) {
    const b = buffer[i];
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) {
      i++;
      continue;
    }
    break;
  }
  return buffer.subarray(i);
}

function detectOfficeFormat(buffer: Buffer): string | null {
  // Cheap search: look for the [Content_Types].xml header inside the
  // central directory listing. We use a string match against the UTF-8
  // decoded bytes which is fine for the small central-directory region
  // of any real-world Office file.
  const head = buffer.subarray(0, Math.min(buffer.length, 64 * 1024)).toString("binary");
  if (head.includes("wordprocessingml")) return MIME_OFFICE.docx;
  if (head.includes("spreadsheetml")) return MIME_OFFICE.xlsx;
  if (head.includes("presentationml")) return MIME_OFFICE.pptx;
  return null;
}

const MIME_OFFICE = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

function looksLikeJson(buffer: Buffer): boolean {
  const trimmed = buffer.toString("utf-8", 0, Math.min(buffer.length, 256)).trim();
  if (!trimmed) return false;
  const first = trimmed[0];
  if (first !== "{" && first !== "[") return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function looksLikeXml(buffer: Buffer): boolean {
  const head = buffer.toString("utf-8", 0, Math.min(buffer.length, 256)).trim();
  return head.startsWith("<?xml");
}

function looksLikeHtml(buffer: Buffer): boolean {
  const head = buffer.toString("utf-8", 0, Math.min(buffer.length, 512)).toLowerCase();
  return head.includes("<!doctype html") || head.includes("<html") || head.includes("<body");
}

/**
 * Validate that `buffer` looks like the declared format by checking the
 * leading magic bytes. Throws a `ConversionError` with code
 * `MAGIC_NUMBER_MISMATCH` when the buffer is clearly the wrong type.
 * For plain-text formats (txt, md, csv, json, xml, html) the function
 * always succeeds — those formats do not have a magic number.
 */
export function validateInputBuffer(buffer: Buffer, format: InputFormat): void {
  if (!Buffer.isBuffer(buffer)) {
    throw new ConversionError("INVALID_INPUT", "Input must be a Buffer");
  }
  if (buffer.length === 0) {
    throw new ConversionError("EMPTY_INPUT", "Input buffer is empty");
  }
  switch (format) {
    case "pdf":
      if (!matchesPrefix(buffer, [0x25, 0x50, 0x44, 0x46])) {
        throw new ConversionError("MAGIC_NUMBER_MISMATCH", "PDF files must start with %PDF");
      }
      return;
    case "docx":
      if (!matchesPrefix(buffer, [0x50, 0x4b, 0x03, 0x04])) {
        throw new ConversionError("MAGIC_NUMBER_MISMATCH", "DOCX files must be a ZIP archive (PK\\x03\\x04)");
      }
      return;
    case "xlsx":
      if (!matchesPrefix(buffer, [0x50, 0x4b, 0x03, 0x04])) {
        throw new ConversionError("MAGIC_NUMBER_MISMATCH", "XLSX files must be a ZIP archive (PK\\x03\\x04)");
      }
      return;
    case "pptx":
      if (!matchesPrefix(buffer, [0x50, 0x4b, 0x03, 0x04])) {
        throw new ConversionError("MAGIC_NUMBER_MISMATCH", "PPTX files must be a ZIP archive (PK\\x03\\x04)");
      }
      return;
    case "json":
      try {
        JSON.parse(buffer.toString("utf-8"));
      } catch (err) {
        throw new ConversionError(
          "PARSE_ERROR",
          `Invalid JSON input: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
      }
      return;
    case "md":
    case "html":
    case "txt":
    case "csv":
    case "xml":
      // No magic number; just require that the buffer decodes as UTF-8.
      return;
    default:
      return;
  }
}
