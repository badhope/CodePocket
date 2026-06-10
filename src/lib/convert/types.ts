export type InputFormat = "docx" | "pdf" | "md" | "html" | "txt" | "xlsx" | "csv" | "json" | "xml" | "pptx";
export type OutputFormat = "pdf" | "docx" | "html" | "md" | "txt" | "csv" | "json" | "xlsx";

export const INPUT_FORMATS = [
  "docx",
  "pdf",
  "md",
  "html",
  "txt",
  "xlsx",
  "csv",
  "json",
  "xml",
  "pptx",
] as const;
export const OUTPUT_FORMATS = ["pdf", "docx", "html", "md", "txt", "csv", "json", "xlsx"] as const;

export interface ConversionOptions {
  inputFormat: InputFormat;
  outputFormat: OutputFormat;
  filename: string;
  /**
   * Timeout in milliseconds. Default 30000 (30s).
   */
  timeout?: number;
  /**
   * Concurrency for batch processing. Default 3.
   */
  concurrency?: number;
  /**
   * Skip input magic-number validation. Default false.
   */
  skipValidation?: boolean;
  /**
   * Skip LRU cache. Default false.
   */
  skipCache?: boolean;
}

export interface ConversionResult {
  success: boolean;
  outputBuffer?: Buffer;
  outputFilename?: string;
  outputFormat: OutputFormat;
  mimeType: string;
  error?: string;
  errorCode?: ConversionErrorCode;
  metadata?: {
    originalSize: number;
    convertedSize: number;
    duration: number;
    pageCount?: number;
  };
  metrics?: ConversionMetrics;
}

export interface ConversionJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  inputFormat: InputFormat;
  outputFormat: OutputFormat;
  inputFilename: string;
  outputFilename?: string;
  progress: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  result?: ConversionResult;
}

export const MIME_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  md: "text/markdown",
  html: "text/html",
  txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export const EXTENSIONS: Record<string, string> = {
  docx: ".docx",
  pdf: ".pdf",
  md: ".md",
  html: ".html",
  txt: ".txt",
  xlsx: ".xlsx",
  csv: ".csv",
  json: ".json",
  xml: ".xml",
  pptx: ".pptx",
};

/**
 * Canonical, strongly-typed mapping from a known format to its MIME type.
 * Falls back to `application/octet-stream` when the format is unknown.
 */
export const MIME_BY_FORMAT: Record<InputFormat | OutputFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  md: "text/markdown",
  html: "text/html",
  txt: "text/plain",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  json: "application/json",
  xml: "application/xml",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/**
 * Canonical, strongly-typed mapping from a known format to its file extension
 * (including the leading dot).
 */
export const FORMAT_EXTENSIONS: Record<InputFormat | OutputFormat, string> = {
  docx: ".docx",
  pdf: ".pdf",
  md: ".md",
  html: ".html",
  txt: ".txt",
  xlsx: ".xlsx",
  csv: ".csv",
  json: ".json",
  xml: ".xml",
  pptx: ".pptx",
};

export const CONVERSION_MAP: Record<string, string[]> = {
  docx: ["pdf", "html", "md", "txt"],
  pdf: ["docx", "html", "txt"],
  md: ["html", "pdf", "docx", "txt"],
  html: ["pdf", "md", "docx", "txt"],
  txt: ["pdf", "html", "md", "docx"],
  xlsx: ["csv", "json", "html", "pdf"],
  csv: ["json", "xlsx", "html", "pdf"],
  json: ["csv", "html", "xlsx"],
  xml: ["json", "html", "csv"],
  pptx: ["pdf", "html"],
};

/* ------------------------------------------------------------------ */
/*                          Enhanced types                            */
/* ------------------------------------------------------------------ */

/**
 * Classification of conversion errors so callers can branch on the kind
 * of failure (timeouts, memory pressure, invalid format, etc).
 */
export type ConversionErrorCode =
  | "UNSUPPORTED_PAIR"
  | "INVALID_INPUT"
  | "PARSE_ERROR"
  | "TIMEOUT"
  | "OUT_OF_MEMORY"
  | "EMPTY_INPUT"
  | "MAGIC_NUMBER_MISMATCH"
  | "INPUT_TOO_LARGE"
  | "UNKNOWN";

/**
 * Thrown for all conversion errors. Carries a stable `code` so consumers
 * can branch on the failure mode without parsing the message.
 */
export class ConversionError extends Error {
  readonly code: ConversionErrorCode;
  override readonly cause?: unknown;

  constructor(code: ConversionErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "ConversionError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * A progress callback receives the fraction in `[0, 1]` plus a `stage`
 * label so UIs can render meaningful status messages.
 */
export type ConversionProgressCallback = (progress: number, stage: ConversionStage) => void;

export type ConversionStage = "validating" | "parsing" | "transforming" | "encoding" | "finalizing" | "done";

/**
 * Lifecycle event emitted while a conversion is running. Subscribers can
 * react asynchronously without blocking the conversion pipeline.
 */
export interface ConversionEvent {
  type: "start" | "progress" | "complete" | "error";
  progress: number;
  stage: ConversionStage;
  timestamp: number;
  error?: ConversionError;
  result?: ConversionResult;
}

/**
 * Outcome of a batch conversion. `results` mirrors the input order, and
 * `summary` aggregates the pass / fail counts.
 */
export interface BatchConversionResult {
  results: ConversionResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    duration: number;
  };
}

/**
 * Performance metrics collected for a single conversion. All durations are
 * in milliseconds and sizes are in bytes. `peakMemoryMb` is best-effort
 * and may be `undefined` in environments where `process.memoryUsage` is
 * unavailable (e.g. the browser).
 */
export interface ConversionMetrics {
  inputSize: number;
  outputSize: number;
  duration: number;
  parseDuration?: number;
  transformDuration?: number;
  encodeDuration?: number;
  peakMemoryMb?: number;
  startedAt: number;
  finishedAt: number;
}

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_BATCH_CONCURRENCY = 3;
export const DEFAULT_MAX_INPUT_SIZE = 50 * 1024 * 1024;
export const DEFAULT_MAX_TEXT_SIZE = 10 * 1024 * 1024;
export const CACHE_MAX_ENTRIES = 100;
