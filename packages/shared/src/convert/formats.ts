/**
 * @docforge/shared/convert — 文档转换层。
 *
 * 9 种格式对：
 *  1. MD  → HTML        （marked, 纯前端）
 *  2. HTML → MD         （turndown, 纯前端）
 *  3. MD  → TXT         （strip markdown, 纯前端）
 *  4. TXT → MD          （wrap, 纯前端）
 *  5. HTML → JSON       （DOM walk, 纯前端）
 *  6. JSON → HTML       （escape, 纯前端）
 *  7. JSON → XML        （fast-xml-parser, 纯前端）
 *  8. XML  → JSON       （fast-xml-parser, 纯前端）
 *  9. HTML → PDF        （pdf-lib, 纯前端；可选后端 fallback）
 *
 * DOCX / XLSX 走 backend /api/convert（h5 用 ApiClient 调）。
 * 由 `engine.ts` 统一调度。
 */

/** 文档格式枚举 */
export type DocumentFormat = "md" | "html" | "txt" | "json" | "xml" | "pdf" | "docx" | "xlsx";

/** 转换方向（from → to） */
export interface ConversionPair {
  readonly from: DocumentFormat;
  readonly to: DocumentFormat;
  /** 显示标签 */
  readonly label?: string;
  /** 能否纯前端（false = 必须后端） */
  readonly local: boolean;
  /** 主用实现（无值表示纯客户端尚未实现，需后端） */
  readonly hint:
    | "marked"
    | "turndown"
    | "fast-xml-parser"
    | "pdf-lib"
    | "strip"
    | "wrap"
    | "html-walk"
    | "escape"
    | "backend";
}

/** MIME / 扩展名 元数据 */
export const FORMAT_MIME: Record<DocumentFormat, string> = {
  md: "text/markdown",
  html: "text/html",
  txt: "text/plain",
  json: "application/json",
  xml: "application/xml",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** 9 种本地格式对 + 2 种后端-only 格式对（DOCX / XLSX 走 /api/convert） */
export const CONVERSION_PAIRS: readonly ConversionPair[] = [
  { from: "md", to: "html", local: true, hint: "marked" },
  { from: "html", to: "md", local: true, hint: "turndown" },
  { from: "md", to: "txt", local: true, hint: "strip" },
  { from: "txt", to: "md", local: true, hint: "wrap" },
  { from: "html", to: "json", local: true, hint: "html-walk" },
  { from: "json", to: "html", local: true, hint: "escape" },
  { from: "json", to: "xml", local: true, hint: "fast-xml-parser" },
  { from: "xml", to: "json", local: true, hint: "fast-xml-parser" },
  { from: "html", to: "pdf", local: true, hint: "pdf-lib" },
  { from: "docx", to: "html", local: false, hint: "backend" },
  { from: "xlsx", to: "html", local: false, hint: "backend" },
];

/** 查找 (from, to) 对应的元数据 */
export function findPair(from: DocumentFormat, to: DocumentFormat): ConversionPair | undefined {
  return CONVERSION_PAIRS.find((p) => p.from === from && p.to === to);
}

/** 列举所有本地能做的对（用于 UI badge） */
export function listLocalPairs(): readonly ConversionPair[] {
  return CONVERSION_PAIRS.filter((p) => p.local);
}
