import type {
  BatchConversionResult,
  ConversionErrorCode,
  ConversionEvent,
  ConversionMetrics,
  ConversionOptions,
  ConversionProgressCallback,
  ConversionResult,
  InputFormat,
  OutputFormat,
} from "./types";
import {
  ConversionError,
  DEFAULT_BATCH_CONCURRENCY,
  DEFAULT_MAX_INPUT_SIZE,
  DEFAULT_TIMEOUT_MS,
  MIME_TYPES,
} from "./types";
import { getOutputFilename, isConversionSupported } from "./formats";
import { convertDocxToHtml, convertDocxToMarkdown, convertDocxToPdf, convertDocxToText } from "./docx";
import { convertPdfToDocx, convertPdfToHtml, convertPdfToText } from "./pdf";
import {
  convertHtmlToMarkdown,
  convertMarkdownToDocx,
  convertMarkdownToHtml,
  convertMarkdownToPdf,
} from "./markdown";
import {
  convertCsvToExcel,
  convertCsvToHtml,
  convertCsvToJson,
  convertExcelToCsv,
  convertExcelToHtml,
  convertExcelToJson,
  convertExcelToPdf,
  convertJsonToCsv,
  convertJsonToCsvBuffer,
  convertJsonToHtml,
} from "./excel";
import { ConversionCache } from "./cache";
import { validateInputBuffer } from "./sanitize";
import { chunkProcess } from "./streaming";

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!;
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xedb88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildMinimalDocx(text: string): Buffer {
  const escapedText = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "</w:t></w:r></w:p><w:p><w:r><w:t>");

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapedText}</w:t></w:r></w:p></w:body></w:document>`;
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  const files: { name: string; data: Buffer }[] = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml, "utf-8") },
    { name: "_rels/.rels", data: Buffer.from(relsXml, "utf-8") },
    { name: "word/document.xml", data: Buffer.from(documentXml, "utf-8") },
    { name: "word/_rels/document.xml.rels", data: Buffer.from(docRelsXml, "utf-8") },
  ];

  let centralOffset = 0;
  const localHeaders: Buffer[] = [];

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf-8");
    const crc = crc32(file.data);
    const header = Buffer.alloc(30 + nameBytes.length);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(0, 10);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(file.data.length, 18);
    header.writeUInt32LE(file.data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    header.writeUInt16LE(0, 28);
    nameBytes.copy(header, 30);
    localHeaders.push(header);
    localHeaders.push(file.data);
    centralOffset += header.length + file.data.length;
  }

  const centralEntries: Buffer[] = [];
  let localOffset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf-8");
    const crc = crc32(file.data);
    const entry = Buffer.alloc(46 + nameBytes.length);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt32LE(0, 12);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(file.data.length, 20);
    entry.writeUInt32LE(file.data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt32LE(0, 34);
    entry.writeUInt32LE(localOffset, 42);
    nameBytes.copy(entry, 46);
    centralEntries.push(entry);
    localOffset += 30 + nameBytes.length + file.data.length;
  }

  const centralDir = Buffer.concat(centralEntries);
  const centralSize = centralDir.length;
  const centralOffsetVal = centralOffset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffsetVal, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, centralDir, eocd]);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function xmlToJson(xml: string): string {
  const tagRegex = /<([a-zA-Z_][\w.-]*)([^>]*)>([\s\S]*?)<\/\1>/g;
  const result: Record<string, unknown> = {};
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(xml)) !== null) {
    const tagName = match[1]!;
    const innerXml = match[3]!;
    const childMatch = /<[a-zA-Z_]/.test(innerXml);
    result[tagName] = childMatch ? JSON.parse(xmlToJson(innerXml)) : innerXml.trim();
  }

  if (Object.keys(result).length === 0) {
    const simpleValue = xml.replace(/<[^>]*>/g, "").trim();
    if (simpleValue) {
      return JSON.stringify(simpleValue);
    }
    return JSON.stringify(xml.trim());
  }

  return JSON.stringify(result, null, 2);
}

function xmlToCsv(xml: string): string {
  const rowRegex = /<(?:item|row|record|entry)[^>]*>([\s\S]*?)<\/(?:item|row|record|entry)>/g;
  const fieldRegex = /<([a-zA-Z_][\w.-]*)[^>]*>([\s\S]*?)<\/\1>/g;
  const rows: Map<string, string>[] = [];
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1]!;
    const row: Map<string, string> = new Map();
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldRegex.exec(rowContent)) !== null) {
      row.set(fieldMatch[1]!, fieldMatch[2]!.trim());
    }
    if (row.size > 0) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    const obj = JSON.parse(xmlToJson(xml));
    const arr = Array.isArray(obj) ? obj : [obj];
    if (arr.length === 0) return "";
    const headers = Object.keys(arr[0] as object);
    const csvRows = [headers.join(",")];
    for (const item of arr) {
      const record = item as Record<string, unknown>;
      csvRows.push(headers.map((h) => `"${String(record[h] ?? "").replace(/"/g, '""')}"`).join(","));
    }
    return csvRows.join("\n");
  }

  const headers = Array.from(new Set(rows.flatMap((r) => Array.from(r.keys()))));
  const csvRows = [headers.join(",")];
  for (const row of rows) {
    csvRows.push(headers.map((h) => `"${(row.get(h) ?? "").replace(/"/g, '""')}"`).join(","));
  }
  return csvRows.join("\n");
}

function extractPptxText(buffer: Buffer): string {
  const localFileSig = 0x04034b50;
  let offset = 0;
  const slideTexts: string[] = [];

  while (offset < buffer.length - 30) {
    const sig = buffer.readUInt32LE(offset);
    if (sig !== localFileSig) break;

    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const dataLen = buffer.readUInt32LE(offset + 18);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLen + extraLen;

    const name = buffer.subarray(nameStart, nameStart + nameLen).toString("utf-8");

    if (name.startsWith("ppt/slides/slide") && name.endsWith(".xml")) {
      const xmlData = buffer.subarray(dataStart, dataStart + dataLen).toString("utf-8");
      const textMatches = xmlData.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
      if (textMatches) {
        const texts = textMatches.map((t) => t.replace(/<[^>]*>/g, "").trim()).filter(Boolean);
        slideTexts.push(texts.join(" "));
      }
    }

    offset = dataStart + dataLen;
  }

  return slideTexts.join("\n\n");
}

async function textToPdf(text: string): Promise<Buffer> {
  const { default: JsPDF } = await import("jspdf");

  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const marginY = 40;
  const maxWidth = pageWidth - marginX * 2;
  let cursorY = marginY;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  function ensureSpace(needed: number) {
    if (cursorY + needed > pageHeight - marginY) {
      doc.addPage();
      cursorY = marginY;
    }
  }

  for (const raw of text.split(/\r?\n/)) {
    const wrapped = doc.splitTextToSize(raw, maxWidth);
    ensureSpace(wrapped.length * 15 + 2);
    doc.text(wrapped, marginX, cursorY);
    cursorY += wrapped.length * 15 + 2;
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const { default: JsPDF } = await import("jspdf");

  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const marginY = 40;
  const maxWidth = pageWidth - marginX * 2;
  let cursorY = marginY;

  const decode = (s: string) =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

  const stripTags = (s: string): string => s.replace(/<[^>]+>/g, "");

  function ensureSpace(needed: number) {
    if (cursorY + needed > pageHeight - marginY) {
      doc.addPage();
      cursorY = marginY;
    }
  }

  function writeWrapped(
    text: string,
    font: "helvetica" | "courier" = "helvetica",
    style: "normal" | "bold" = "normal",
    size = 11,
    lineHeight = 15,
  ) {
    doc.setFont(font, style);
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text || " ", maxWidth);
    ensureSpace(wrapped.length * lineHeight + 4);
    doc.text(wrapped, marginX, cursorY);
    cursorY += wrapped.length * lineHeight + 2;
  }

  const lines = html.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      cursorY += 4;
      continue;
    }
    if (line.startsWith("<h1")) {
      writeWrapped(decode(stripTags(line)), "helvetica", "bold", 20, 26);
    } else if (line.startsWith("<h2")) {
      writeWrapped(decode(stripTags(line)), "helvetica", "bold", 16, 22);
    } else if (line.startsWith("<h3")) {
      writeWrapped(decode(stripTags(line)), "helvetica", "bold", 13, 18);
    } else if (line.startsWith("<li>")) {
      writeWrapped("•  " + decode(stripTags(line)), "helvetica", "normal", 11, 14);
    } else if (line.startsWith("<p") || line.startsWith("<div")) {
      writeWrapped(decode(stripTags(line)), "helvetica", "normal", 11, 15);
    } else {
      writeWrapped(decode(stripTags(line)));
    }
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

function textToHtml(text: string): string {
  const escaped = escapeHtml(text);
  const paragraphs = escaped.split(/\n\n+/).filter(Boolean);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Document</title></head><body>${paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("\n")}</body></html>`;
}

/* ------------------------------------------------------------------ */
/*                     Core conversion dispatcher                      */
/* ------------------------------------------------------------------ */

/**
 * Run a single conversion and return a `Buffer`. Throws on any failure
 * (the public `convert` wrapper turns thrown errors into a structured
 * `ConversionResult`). The progress callback is invoked at the major
 * pipeline stages so callers can drive a UI.
 */
async function runConversion(
  input: Buffer,
  options: ConversionOptions,
  onProgress?: ConversionProgressCallback,
): Promise<Buffer> {
  const { inputFormat, outputFormat } = options;
  const report = (p: number, stage: Parameters<ConversionProgressCallback>[1]) => onProgress?.(p, stage);

  report(0.05, "validating");
  if (!isConversionSupported(inputFormat, outputFormat)) {
    throw new ConversionError(
      "UNSUPPORTED_PAIR",
      `Conversion from ${inputFormat} to ${outputFormat} is not supported`,
    );
  }
  if (!options.skipValidation) {
    validateInputBuffer(input, inputFormat);
  }
  if (input.length > DEFAULT_MAX_INPUT_SIZE) {
    throw new ConversionError(
      "INPUT_TOO_LARGE",
      `Input exceeds maximum size of ${DEFAULT_MAX_INPUT_SIZE} bytes`,
    );
  }

  report(0.1, "parsing");

  switch (`${inputFormat}->${outputFormat}`) {
    case "docx->html": {
      report(0.4, "transforming");
      const html = await convertDocxToHtml(input);
      report(0.9, "encoding");
      return Buffer.from(html, "utf-8");
    }
    case "docx->md": {
      const md = await convertDocxToMarkdown(input);
      return Buffer.from(md, "utf-8");
    }
    case "docx->txt": {
      const txt = await convertDocxToText(input);
      return Buffer.from(txt, "utf-8");
    }
    case "docx->pdf": {
      return await convertDocxToPdf(input);
    }

    case "pdf->txt": {
      const txt = await convertPdfToText(input);
      return Buffer.from(txt, "utf-8");
    }
    case "pdf->html": {
      const html = await convertPdfToHtml(input);
      return Buffer.from(html, "utf-8");
    }
    case "pdf->docx": {
      return await convertPdfToDocx(input);
    }

    case "md->html": {
      const html = await convertMarkdownToHtml(input.toString("utf-8"));
      return Buffer.from(html, "utf-8");
    }
    case "md->pdf": {
      return await convertMarkdownToPdf(input.toString("utf-8"));
    }
    case "md->docx": {
      return await convertMarkdownToDocx(input.toString("utf-8"));
    }
    case "md->txt": {
      const html = await convertMarkdownToHtml(input.toString("utf-8"));
      const txt = stripHtml(html);
      return Buffer.from(txt, "utf-8");
    }

    case "html->pdf": {
      return await htmlToPdf(input.toString("utf-8"));
    }
    case "html->md": {
      const md = await convertHtmlToMarkdown(input.toString("utf-8"));
      return Buffer.from(md, "utf-8");
    }
    case "html->docx": {
      const text = stripHtml(input.toString("utf-8"));
      return buildMinimalDocx(text);
    }
    case "html->txt": {
      const txt = stripHtml(input.toString("utf-8"));
      return Buffer.from(txt, "utf-8");
    }

    case "txt->pdf": {
      return await textToPdf(input.toString("utf-8"));
    }
    case "txt->html": {
      const html = textToHtml(input.toString("utf-8"));
      return Buffer.from(html, "utf-8");
    }
    case "txt->md": {
      return input;
    }
    case "txt->docx": {
      return buildMinimalDocx(input.toString("utf-8"));
    }

    case "xlsx->csv": {
      const csv = await convertExcelToCsv(input);
      return Buffer.from(csv, "utf-8");
    }
    case "xlsx->json": {
      const json = await convertExcelToJson(input);
      return Buffer.from(json, "utf-8");
    }
    case "xlsx->html": {
      const html = await convertExcelToHtml(input);
      return Buffer.from(html, "utf-8");
    }
    case "xlsx->pdf": {
      return await convertExcelToPdf(input);
    }

    case "csv->json": {
      const json = await convertCsvToJson(input.toString("utf-8"));
      return Buffer.from(json, "utf-8");
    }
    case "csv->xlsx": {
      return await convertCsvToExcel(input.toString("utf-8"));
    }
    case "csv->html": {
      const html = await convertCsvToHtml(input.toString("utf-8"));
      return Buffer.from(html, "utf-8");
    }
    case "csv->pdf": {
      const html = await convertCsvToHtml(input.toString("utf-8"));
      return await htmlToPdf(html);
    }

    case "json->csv": {
      const csv = await convertJsonToCsv(input.toString("utf-8"));
      return Buffer.from(csv, "utf-8");
    }
    case "json->html": {
      const html = await convertJsonToHtml(input.toString("utf-8"));
      return Buffer.from(html, "utf-8");
    }
    case "json->xlsx": {
      return await convertJsonToCsvBuffer(input.toString("utf-8"));
    }

    case "xml->json": {
      const json = xmlToJson(input.toString("utf-8"));
      return Buffer.from(json, "utf-8");
    }
    case "xml->html": {
      const json = xmlToJson(input.toString("utf-8"));
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>XML Data</title></head><body><pre>${escapeHtml(json)}</pre></body></html>`;
      return Buffer.from(html, "utf-8");
    }
    case "xml->csv": {
      const csv = xmlToCsv(input.toString("utf-8"));
      return Buffer.from(csv, "utf-8");
    }

    case "pptx->pdf": {
      const text = extractPptxText(input);
      return await textToPdf(text);
    }
    case "pptx->html": {
      const text = extractPptxText(input);
      const html = textToHtml(text);
      return Buffer.from(html, "utf-8");
    }

    default: {
      throw new ConversionError(
        "UNSUPPORTED_PAIR",
        `Conversion from ${inputFormat} to ${outputFormat} is not implemented`,
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*                       Helpers: error / metrics                      */
/* ------------------------------------------------------------------ */

function classifyError(err: unknown): ConversionErrorCode {
  if (err instanceof ConversionError) return err.code;
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("timeout") || message.includes("timed out")) return "TIMEOUT";
    if (
      message.includes("out of memory") ||
      message.includes("allocation failed") ||
      message.includes("heap")
    ) {
      return "OUT_OF_MEMORY";
    }
    if (message.includes("empty") || message.includes("no data")) return "EMPTY_INPUT";
    if (message.includes("unsupported") || message.includes("not implemented")) {
      return "UNSUPPORTED_PAIR";
    }
    if (message.includes("parse") || message.includes("invalid")) return "PARSE_ERROR";
  }
  return "UNKNOWN";
}

function safeMemoryUsage(): { rss: number; heapUsed: number } | undefined {
  try {
    // `process` is unavailable in the browser; the cast keeps us safe.
    if (typeof process !== "undefined" && typeof process.memoryUsage === "function") {
      const mu = process.memoryUsage();
      return { rss: mu.rss, heapUsed: mu.heapUsed };
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function buildFailureResult(options: ConversionOptions, err: unknown, startTime: number): ConversionResult {
  const code = classifyError(err);
  const message = err instanceof Error ? err.message : String(err);
  const base = {
    success: false as const,
    outputFormat: options.outputFormat,
    mimeType: MIME_TYPES[options.outputFormat] ?? "application/octet-stream",
    error: message,
    errorCode: code,
    metadata: {
      originalSize: 0,
      convertedSize: 0,
      duration: Date.now() - startTime,
    },
  };
  return base;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ConversionError("TIMEOUT", `${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/* ------------------------------------------------------------------ */
/*                         Public API                                  */
/* ------------------------------------------------------------------ */

/**
 * Convert `input` according to `options`. This is the main entry point
 * used by the API route. Errors are captured and returned as a
 * `ConversionResult` with `success: false` so the caller does not have
 * to wrap every call in `try/catch`.
 */
export async function convert(input: Buffer, options: ConversionOptions): Promise<ConversionResult> {
  return convertWithProgress(input, options);
}

/**
 * Like `convert` but forwards a progress callback. The callback is
 * invoked with the current fraction (0..1) and a `ConversionStage`
 * label. Implementations may also call it zero times for very fast
 * conversions.
 */
export async function convertWithProgress(
  input: Buffer,
  options: ConversionOptions,
  onProgress?: ConversionProgressCallback,
): Promise<ConversionResult> {
  const startedAt = Date.now();
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const memBefore = safeMemoryUsage();
  let peakHeap = memBefore?.heapUsed ?? 0;

  try {
    if (!Buffer.isBuffer(input)) {
      throw new ConversionError("INVALID_INPUT", "Input must be a Buffer");
    }
    if (input.length === 0) {
      throw new ConversionError("EMPTY_INPUT", "Input buffer is empty");
    }

    const outputBuffer = await withTimeout(
      runConversion(input, options, (p, stage) => {
        const mem = safeMemoryUsage();
        if (mem && mem.heapUsed > peakHeap) peakHeap = mem.heapUsed;
        onProgress?.(p, stage);
      }),
      timeoutMs,
      `Conversion ${options.inputFormat}->${options.outputFormat}`,
    );

    onProgress?.(1, "done");

    const finishedAt = Date.now();
    const metrics: ConversionMetrics = {
      inputSize: input.length,
      outputSize: outputBuffer.length,
      duration: finishedAt - startedAt,
      startedAt,
      finishedAt,
      peakMemoryMb: peakHeap > 0 ? Math.round((peakHeap / 1024 / 1024) * 100) / 100 : undefined,
    };

    return {
      success: true,
      outputBuffer,
      outputFilename: getOutputFilename(options.filename, options.outputFormat),
      outputFormat: options.outputFormat,
      mimeType: MIME_TYPES[options.outputFormat] ?? "application/octet-stream",
      metadata: {
        originalSize: input.length,
        convertedSize: outputBuffer.length,
        duration: metrics.duration,
      },
      metrics,
    };
  } catch (err) {
    onProgress?.(1, "done");
    const result = buildFailureResult(options, err, startedAt);
    const mem = safeMemoryUsage();
    if (mem) peakHeap = Math.max(peakHeap, mem.heapUsed);
    result.metrics = {
      inputSize: input.length,
      outputSize: 0,
      duration: result.metadata?.duration ?? Date.now() - startedAt,
      startedAt,
      finishedAt: Date.now(),
      peakMemoryMb: peakHeap > 0 ? Math.round((peakHeap / 1024 / 1024) * 100) / 100 : undefined,
    };
    return result;
  }
}

/**
 * Look the input up in the LRU cache first. On a hit, a synthetic
 * `ConversionResult` is returned without invoking the conversion
 * pipeline.
 */
export async function convertWithCache(input: Buffer, options: ConversionOptions): Promise<ConversionResult> {
  const startedAt = Date.now();
  if (options.skipCache) {
    return convert(input, options);
  }
  const cache = ConversionCache.getInstance();
  const cached = cache.get(input, options);
  if (cached) {
    return {
      success: true,
      outputBuffer: cached.outputBuffer,
      outputFilename: cached.outputFilename,
      outputFormat: options.outputFormat,
      mimeType: cached.mimeType,
      metadata: {
        originalSize: input.length,
        convertedSize: cached.outputBuffer.length,
        duration: Date.now() - startedAt,
      },
      metrics: {
        inputSize: input.length,
        outputSize: cached.outputBuffer.length,
        duration: Date.now() - startedAt,
        startedAt,
        finishedAt: Date.now(),
      },
    };
  }

  const result = await convert(input, options);
  if (result.success && result.outputBuffer && result.outputFilename) {
    cache.set(input, options, {
      outputBuffer: result.outputBuffer,
      mimeType: result.mimeType,
      outputFilename: result.outputFilename,
      outputFormat: result.outputFormat,
    });
  }
  return result;
}

export interface BatchItem {
  input: Buffer;
  options: ConversionOptions;
}

/**
 * Convert a batch of inputs in parallel, bounded by a concurrency limit
 * (default 3). Results are returned in input order. A single failing
 * item does not abort the rest of the batch — it is reported as
 * `success: false` in the corresponding slot of `results`.
 */
export async function convertBatch(
  items: readonly BatchItem[],
  sharedOptions?: Partial<ConversionOptions>,
): Promise<BatchConversionResult> {
  const startedAt = Date.now();
  const concurrency = sharedOptions?.concurrency ?? DEFAULT_BATCH_CONCURRENCY;

  const results = await chunkProcess<BatchItem, ConversionResult>(
    items,
    async (item) => {
      const merged: ConversionOptions = { ...sharedOptions, ...item.options };
      try {
        return await convert(item.input, merged);
      } catch (err) {
        return buildFailureResult(merged, err, Date.now());
      }
    },
    {
      concurrency,
    },
  );

  let succeeded = 0;
  for (const r of results) if (r.success) succeeded++;

  return {
    results,
    summary: {
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      duration: Date.now() - startedAt,
    },
  };
}

/**
 * Subscribe to lifecycle events from a single conversion. The returned
 * object mirrors `convertWithProgress` but additionally yields a stream
 * of structured events that can be observed asynchronously.
 */
export async function convertWithEvents(
  input: Buffer,
  options: ConversionOptions,
): Promise<{ result: ConversionResult; events: ConversionEvent[] }> {
  const events: ConversionEvent[] = [];
  const record = (e: Omit<ConversionEvent, "timestamp">) => {
    events.push({ ...e, timestamp: Date.now() });
  };
  record({ type: "start", progress: 0, stage: "validating" });
  const result = await convertWithProgress(input, options, (progress, stage) => {
    record({ type: "progress", progress, stage });
  });
  if (result.success) {
    record({ type: "complete", progress: 1, stage: "done", result });
  } else {
    record({
      type: "error",
      progress: 1,
      stage: "done",
      error: new ConversionError(
        (result.errorCode as ConversionErrorCode) ?? "UNKNOWN",
        result.error ?? "Unknown error",
      ),
    });
  }
  return { result, events };
}
