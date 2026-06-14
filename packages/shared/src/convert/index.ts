/**
 * 转换模块 — 文档格式转换（需要后端）
 */

export type DocumentFormat = "md" | "html" | "txt" | "json" | "xml" | "pdf" | "docx" | "xlsx";

export interface ConvertRequest {
  inputFormat: string;
  outputFormat: string;
  content: string;
}

export interface ConvertResult {
  ok: boolean;
  output?: string | Uint8Array;
  error?: string;
  mime?: string;
  aborted?: boolean;
  pair?: ConversionPair;
}

export interface ConversionPair {
  from: DocumentFormat;
  to: DocumentFormat;
  label: string;
  local: boolean;
  hint: string;
}

export type ProgressFn = (stage: string, progress: number) => void;

export interface BackendConverter {
  convert(
    from: DocumentFormat,
    to: DocumentFormat,
    input: string | Uint8Array,
    onProgress?: ProgressFn,
    signal?: AbortSignal,
  ): Promise<ConvertResult>;
}

export async function convert(
  input: string | Uint8Array,
  from: DocumentFormat,
  to: DocumentFormat,
  options?: {
    onProgress?: ProgressFn;
    backend?: BackendConverter;
    signal?: AbortSignal;
  },
): Promise<ConvertResult> {
  // 如果有后端转换器，使用后端
  if (options?.backend) {
    return options.backend.convert(from, to, input, options.onProgress, options.signal);
  }
  
  // 否则返回错误
  return {
    ok: false,
    error: "Document conversion requires backend. Use /api/convert endpoint.",
  };
}

export function listSupportedPairs(): ConversionPair[] {
  return [
    { from: "md", to: "html", label: "Markdown → HTML", local: true, hint: "marked" },
    { from: "html", to: "md", label: "HTML → Markdown", local: true, hint: "turndown" },
    { from: "docx", to: "pdf", label: "DOCX → PDF", local: false, hint: "backend" },
    { from: "xlsx", to: "pdf", label: "XLSX → PDF", local: false, hint: "backend" },
  ];
}


