import ExcelJS from "exceljs";

/**
 * Helper: extract a primitive value from a cell that may be a string, number,
 * boolean, Date, or a richer ExcelJS object (rich text, formula result, etc.).
 */
function unwrapCellValue(value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as {
      result?: unknown;
      text?: unknown;
      richText?: unknown;
      formula?: unknown;
      hyperlink?: unknown;
    };
    if ("result" in v && v.result !== undefined && v.result !== null) return v.result;
    if ("richText" in v && Array.isArray(v.richText)) {
      return (v.richText as Array<{ text?: string }>).map((r) => r.text ?? "").join("");
    }
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("hyperlink" in v && v.hyperlink) return v.hyperlink;
    if ("formula" in v && typeof v.formula === "string") return v.formula;
    return String(value);
  }
  return value;
}

function formatCsvCell(value: unknown): string {
  const v = unwrapCellValue(value);
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Read a CSV string into an ExcelJS workbook using a temporary worksheet.
 * ExcelJS's CSV reader expects a stream, so we use a Readable from the string.
 */
async function csvStringToWorkbook(csv: string): Promise<ExcelJS.Workbook> {
  const { Readable } = await import("node:stream");
  const workbook = new ExcelJS.Workbook();
  // csv.read accepts a Node Readable; we push the entire CSV in one chunk.
  const stream = Readable.from([Buffer.from(csv, "utf-8")]);
  await workbook.csv.read(stream);
  return workbook;
}

async function bufferToXlsxWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS types were authored against the pre-TS5.7 non-generic `Buffer`.
  // The project uses the generic `Buffer<ArrayBufferLike>`, so we widen with
  // a double cast — runtime is fine because `Buffer` extends `Uint8Array`.
  await workbook.xlsx.load(buffer as unknown as Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0]);
  return workbook;
}

function requireFirstSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error("No sheets found in the Excel file");
  }
  return sheet;
}

function sheetToCsvString(sheet: ExcelJS.Worksheet): string {
  const rows: string[] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[];
    // row.values is 1-indexed; [0] is null
    const cells = values.slice(1);
    rows.push(cells.map((v) => formatCsvCell(v)).join(","));
  });
  return rows.join("\n");
}

function sheetToJsonArray(sheet: ExcelJS.Worksheet): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const headers: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = String(unwrapCellValue(cell.value) ?? "");
      });
    } else {
      const obj: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const key = headers[colNumber - 1] ?? `col${colNumber}`;
        obj[key] = unwrapCellValue(cell.value);
      });
      result.push(obj);
    }
  });
  return result;
}

function sheetToHtmlString(sheet: ExcelJS.Worksheet): string {
  const htmlRows: string[] = ["<table>"];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const tag = rowNumber === 1 ? "th" : "td";
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(`<${tag}>${escapeHtml(String(unwrapCellValue(cell.value) ?? ""))}</${tag}>`);
    });
    htmlRows.push(`<tr>${cells.join("")}</tr>`);
  });
  htmlRows.push("</table>");
  return htmlRows.join("\n");
}

function buildWorkbookFromRows(arr: Record<string, unknown>[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Sheet1");
  const first = arr[0] ?? {};
  const keys = Object.keys(first);
  if (keys.length > 0) {
    ws.columns = keys.map((k) => ({ header: k, key: k }));
    for (const row of arr) {
      ws.addRow(row);
    }
  }
  return workbook;
}

export async function convertExcelToCsv(buffer: Buffer): Promise<string> {
  const workbook = await bufferToXlsxWorkbook(buffer);
  const sheet = requireFirstSheet(workbook);
  return sheetToCsvString(sheet);
}

export async function convertExcelToJson(buffer: Buffer): Promise<string> {
  const workbook = await bufferToXlsxWorkbook(buffer);
  const sheet = requireFirstSheet(workbook);
  const data = sheetToJsonArray(sheet);
  return JSON.stringify(data, null, 2);
}

export async function convertCsvToJson(csv: string): Promise<string> {
  const workbook = await csvStringToWorkbook(csv);
  const sheet = requireFirstSheet(workbook);
  const data = sheetToJsonArray(sheet);
  return JSON.stringify(data, null, 2);
}

export async function convertJsonToCsv(json: string): Promise<string> {
  const data = JSON.parse(json) as unknown;
  const arr = Array.isArray(data) ? (data as Record<string, unknown>[]) : [data as Record<string, unknown>];
  const workbook = buildWorkbookFromRows(arr);
  const sheet = workbook.worksheets[0];
  if (!sheet) return "";
  return sheetToCsvString(sheet);
}

export async function convertCsvToExcel(csv: string): Promise<Buffer> {
  const workbook = await csvStringToWorkbook(csv);
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function convertExcelToHtml(buffer: Buffer): Promise<string> {
  const workbook = await bufferToXlsxWorkbook(buffer);
  const sheet = requireFirstSheet(workbook);
  const html = sheetToHtmlString(sheet);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Excel Data</title></head><body>${html}</body></html>`;
}

export async function convertCsvToHtml(csv: string): Promise<string> {
  const workbook = await csvStringToWorkbook(csv);
  const sheet = requireFirstSheet(workbook);
  const html = sheetToHtmlString(sheet);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CSV Data</title></head><body>${html}</body></html>`;
}

export async function convertJsonToCsvBuffer(json: string): Promise<Buffer> {
  const csv = await convertJsonToCsv(json);
  const workbook = await csvStringToWorkbook(csv);
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function convertJsonToHtml(json: string): Promise<string> {
  const csv = await convertJsonToCsv(json);
  return convertCsvToHtml(csv);
}

export async function convertExcelToPdf(buffer: Buffer): Promise<Buffer> {
  const html = await convertExcelToHtml(buffer);

  const { default: JsPDF } = await import("jspdf");

  const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginY = 20;
  const maxWidth = pageWidth - marginX * 2;
  let cursorY = marginY;

  const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

  function ensureSpace(needed: number) {
    if (cursorY + needed > pageHeight - marginY) {
      doc.addPage();
      cursorY = marginY;
    }
  }

  for (const raw of html.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      cursorY += 3;
      continue;
    }
    if (line.startsWith("<th") || line.startsWith("<td")) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const text = stripTags(line);
      const wrapped = doc.splitTextToSize(text, maxWidth);
      ensureSpace(wrapped.length * 11 + 2);
      doc.text(wrapped, marginX, cursorY);
      cursorY += wrapped.length * 11 + 1;
    } else if (line.startsWith("<h")) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const text = stripTags(line);
      const wrapped = doc.splitTextToSize(text, maxWidth);
      ensureSpace(wrapped.length * 14 + 2);
      doc.text(wrapped, marginX, cursorY);
      cursorY += wrapped.length * 14 + 1;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const text = stripTags(line);
      const wrapped = doc.splitTextToSize(text, maxWidth);
      ensureSpace(wrapped.length * 11 + 2);
      doc.text(wrapped, marginX, cursorY);
      cursorY += wrapped.length * 11 + 1;
    }
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
