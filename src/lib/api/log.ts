/**
 * Lightweight structured JSON logger with:
 *  - per-level helpers (info, warn, error, debug)
 *  - request-scoped context (requestId, userId, ip, path)
 *  - API request logger (auto-computed duration)
 *  - asynchronous non-blocking queue with periodic flush
 *  - full error stack capture
 *
 * The queue is flushed every 250ms (or when it reaches 50 entries), and on
 * `process.on("beforeExit")` / `SIGTERM` / `SIGINT` / `unhandledRejection`.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogMeta {
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  ip?: string;
  path?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  meta?: LogMeta;
}

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_FLUSH_INTERVAL_MS = 250;
const DEFAULT_FLUSH_BATCH_SIZE = 50;

function resolveMinLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const MIN_LEVEL: LogLevel = resolveMinLevel();
const MIN_RANK = LOG_LEVEL_RANK[MIN_LEVEL];

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_RANK[level] >= MIN_RANK;
}

function serializeError(err: unknown): LogEntry["error"] | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  if (typeof err === "string") {
    return { name: "Error", message: err };
  }
  try {
    return { name: "Error", message: JSON.stringify(err) };
  } catch {
    return { name: "Error", message: String(err) };
  }
}

function buildEntry(
  level: LogLevel,
  message: string,
  meta: LogMeta | undefined,
  ctx: RequestContext | undefined,
  error: unknown,
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  if (ctx?.requestId) entry.requestId = ctx.requestId;
  if (ctx?.userId) entry.userId = ctx.userId;
  if (ctx?.ip) entry.ip = ctx.ip;
  if (ctx?.path) entry.path = ctx.path;
  if (ctx?.method) entry.method = ctx.method;
  if (meta && Object.keys(meta).length > 0) entry.meta = meta;
  const errEntry = serializeError(error);
  if (errEntry) entry.error = errEntry;
  return entry;
}

function writeToConsole(entry: LogEntry): void {
  // Use plain console; in serverless environments each line is captured by the
  // platform's log stream (Vercel, Cloudflare, etc).
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else if (entry.level === "debug") {
    console.debug(line);
  } else {
    console.log(line);
  }
}

interface RequestContext {
  requestId?: string;
  userId?: string;
  ip?: string;
  path?: string;
  method?: string;
}

interface QueueState {
  queue: LogEntry[];
  timer: ReturnType<typeof setInterval> | null;
  flushing: boolean;
}

const state: QueueState = {
  queue: [],
  timer: null,
  flushing: false,
};

function flush(): void {
  if (state.flushing) return;
  if (state.queue.length === 0) return;
  state.flushing = true;
  const batch = state.queue.splice(0, state.queue.length);
  try {
    for (const entry of batch) writeToConsole(entry);
  } finally {
    state.flushing = false;
  }
}

function ensureTimer(): void {
  if (state.timer) return;
  if (typeof setInterval === "undefined") return;
  state.timer = setInterval(() => flush(), DEFAULT_FLUSH_INTERVAL_MS);
  if (typeof (state.timer as { unref?: () => void }).unref === "function") {
    (state.timer as { unref?: () => void }).unref?.();
  }
}

function enqueue(entry: LogEntry): void {
  state.queue.push(entry);
  if (state.queue.length >= DEFAULT_FLUSH_BATCH_SIZE) {
    flush();
  } else {
    ensureTimer();
  }
}

function registerLifecycleFlush(): void {
  if (typeof process === "undefined" || !(process as { on?: unknown }).on) return;
  const proc = process as NodeJS.Process;
  if ((proc as unknown as { __docforgeLoggerInstalled?: boolean }).__docforgeLoggerInstalled) return;
  (proc as unknown as { __docforgeLoggerInstalled?: boolean }).__docforgeLoggerInstalled = true;
  const handler = () => {
    flush();
  };
  proc.on("beforeExit", handler);
  proc.on("exit", handler);
  proc.on("SIGTERM", handler);
  proc.on("SIGINT", handler);
  proc.on("uncaughtException", handler);
  proc.on("unhandledRejection", handler);
}

if (typeof process !== "undefined" && (process as { on?: unknown }).on) {
  registerLifecycleFlush();
}

function log(level: LogLevel, message: string, meta?: LogMeta, ctx?: RequestContext, error?: unknown): void {
  if (!shouldLog(level)) return;
  const entry = buildEntry(level, message, meta, ctx, error);
  enqueue(entry);
}

/**
 * Public API. Use the {@link logger.withContext} helper to attach request
 * metadata to subsequent calls.
 */
export interface Logger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta | unknown, error?: unknown): void;
  api(
    req: { method?: string; path?: string; ip?: string; userId?: string; requestId?: string },
    status: number,
    durationMs: number,
    meta?: LogMeta,
  ): void;
  withContext(ctx: RequestContext): ScopedLogger;
  flush(): void;
}

export type ScopedLogger = Logger;

function createLogger(scopeCtx?: RequestContext): Logger {
  return {
    debug(message, meta) {
      log("debug", message, meta, scopeCtx);
    },
    info(message, meta) {
      log("info", message, meta, scopeCtx);
    },
    warn(message, meta) {
      log("warn", message, meta, scopeCtx);
    },
    error(message, metaOrError, errorArg) {
      if (
        metaOrError instanceof Error ||
        typeof metaOrError === "string" ||
        (metaOrError && typeof metaOrError === "object" && "stack" in (metaOrError as object))
      ) {
        log("error", message, undefined, scopeCtx, metaOrError);
      } else {
        log("error", message, metaOrError as LogMeta | undefined, scopeCtx, errorArg);
      }
    },
    api(req, status, durationMs, meta) {
      const ctx: RequestContext = {
        ...(scopeCtx ?? {}),
        method: req.method,
        path: req.path,
        ip: req.ip,
        userId: req.userId,
        requestId: req.requestId,
      };
      const level: LogLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      log(level, "api_request", { status, durationMs, ...(meta ?? {}) }, ctx);
    },
    withContext(extra) {
      return createLogger({ ...(scopeCtx ?? {}), ...extra });
    },
    flush() {
      flush();
    },
  };
}

export const logger: Logger = createLogger();

/**
 * Generate a short random request id (no external dependency).
 */
export function newRequestId(): string {
  // Prefer crypto.randomUUID when available, fall back to a timestamped
  // random string.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/**
 * Helper to extract the best-guess client IP from a NextRequest / Request.
 */
export function getClientIp(req: Request | { headers: Headers }): string {
  const headers = req.headers;
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real;
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf;
  return "unknown";
}
