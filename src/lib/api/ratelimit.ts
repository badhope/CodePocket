import { rateLimit, backend, upstash } from "@/lib/storage/redis";
import { logger } from "./log";

/**
 * Multi-dimensional rate limiter (global -> per-route -> per-user) with
 * production-grade fail semantics:
 *
 *   - If a Redis backend is configured, all checks are enforced.
 *   - If NO backend is configured at all, the limiter surfaces 503 by
 *     returning success: false (callers are expected to map this to a 503).
 *
 * The "fail-open" path is removed on purpose: silently letting traffic through
 * when a backend is misconfigured defeats the purpose of rate limiting.
 */

export type LimitAlgorithm = "sliding" | "fixed";

export interface RouteLimit {
  /** Window duration, e.g. "1 m", "10 s", "1 h" */
  window: string;
  /** Max number of allowed events inside the window */
  max: number;
  /** Optional per-user (authenticated) cap; falls back to max * 4 when unset */
  perUserMax?: number;
  /** Optional explicit algorithm */
  algorithm?: LimitAlgorithm;
}

export interface RouteLimitConfig extends RouteLimit {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "*";
  pathPrefix: string;
}

export interface RouteLimiterOptions {
  global?: { window: string; max: number };
  routes?: RouteLimitConfig[];
}

const DEFAULT_GLOBAL = { window: "1 m", max: 240 };

function parseWindow(window: string): number {
  const m = window.trim().match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!m) return 60_000;
  const n = Number(m[1] ?? 60);
  const unit = (m[2] ?? "s").toLowerCase();
  switch (unit) {
    case "ms":
      return n;
    case "s":
      return n * 1000;
    case "m":
      return n * 60 * 1000;
    case "h":
      return n * 60 * 60 * 1000;
    case "d":
      return n * 24 * 60 * 60 * 1000;
    default:
      return 60_000;
  }
}

type LimitFn = (key: string) => Promise<{
  success: boolean;
  remaining: number;
  limit: number;
  reset: number;
}>;

const limiterCache = new Map<string, LimitFn>();
const limiterInitCache = new Map<string, Promise<LimitFn>>();

function getLimiter(prefix: string, max: number, window: string): LimitFn | Promise<LimitFn> | null {
  if (backend() === "none") return null;
  const key = `${prefix}:${max}:${window}`;
  const cached = limiterCache.get(key);
  if (cached) return cached;
  const inFlight = limiterInitCache.get(key);
  if (inFlight) return inFlight;
  const init: Promise<LimitFn> = rateLimit({ prefix, limit: max, windowMs: parseWindow(window) }).then(
    (fn) => {
      limiterCache.set(key, fn);
      return fn;
    },
  );
  limiterInitCache.set(key, init);
  return init;
}

export interface CheckInput {
  method: string;
  path: string;
  ip: string;
  userId?: string;
}

export interface CheckResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: number;
  scope: "global" | "route" | "user" | "unconfigured";
  retryAfterMs: number;
}

function matchRoute(method: string, path: string, routes: RouteLimitConfig[] = []): RouteLimitConfig | null {
  for (const r of routes) {
    if (r.method !== "*" && r.method !== method) continue;
    if (!path.startsWith(r.pathPrefix)) continue;
    return r;
  }
  return null;
}

/**
 * The main entry-point. Performs global -> per-route -> per-user checks in
 * that order, returning the first failure.
 *
 * Returns success: false (with scope: "unconfigured") when no Redis backend
 * is configured at all, so the caller can surface a 503 with a clear error.
 */
export async function checkRateLimit(
  input: CheckInput,
  options: RouteLimiterOptions = {},
): Promise<CheckResult> {
  const global = options.global ?? DEFAULT_GLOBAL;
  const routes = options.routes ?? [];

  // No backend at all -> return a denial so the caller can 503. This replaces
  // the previous "fail-open" behaviour.
  if (backend() === "none") {
    return {
      success: false,
      remaining: 0,
      limit: 0,
      reset: 0,
      scope: "unconfigured",
      retryAfterMs: 0,
    };
  }
  // If the only backend we have is Upstash and it is not reachable, let the
  // per-call try/catch surface the error to the route layer.
  void upstash;

  // 1. Global per-IP cap.
  const globalLimiter = await getLimiter("rl:global", global.max, global.window);
  if (globalLimiter) {
    try {
      const r = await globalLimiter(`ip:${input.ip}`);
      if (!r.success) {
        return {
          success: false,
          remaining: r.remaining,
          limit: r.limit,
          reset: r.reset,
          scope: "global",
          retryAfterMs: Math.max(0, r.reset * 1000 - Date.now()),
        };
      }
    } catch (err) {
      logger.warn("rate_limit_backend_error", { reason: "global_error", path: input.path, err });
      return {
        success: false,
        remaining: 0,
        limit: 0,
        reset: 0,
        scope: "unconfigured",
        retryAfterMs: 0,
      };
    }
  }

  // 2. Per-route cap.
  const route = matchRoute(input.method, input.path, routes);
  if (route) {
    const routeLimiter = await getLimiter(
      `rl:route:${route.method === "*" ? "any" : route.method.toLowerCase()}:${route.pathPrefix.replace(/[^a-z0-9]+/gi, "_")}`,
      route.max,
      route.window,
    );
    if (routeLimiter) {
      try {
        const r = await routeLimiter(`ip:${input.ip}`);
        if (!r.success) {
          return {
            success: false,
            remaining: r.remaining,
            limit: r.limit,
            reset: r.reset,
            scope: "route",
            retryAfterMs: Math.max(0, r.reset * 1000 - Date.now()),
          };
        }
      } catch (err) {
        logger.warn("rate_limit_backend_error", { reason: "route_error", path: input.path, err });
        return {
          success: false,
          remaining: 0,
          limit: 0,
          reset: 0,
          scope: "unconfigured",
          retryAfterMs: 0,
        };
      }
    }

    // 3. Per-user cap (authenticated only).
    if (input.userId) {
      const perUserMax = route.perUserMax ?? route.max * 4;
      const userLimiter = await getLimiter(
        `rl:user:${route.pathPrefix.replace(/[^a-z0-9]+/gi, "_")}`,
        perUserMax,
        route.window,
      );
      if (userLimiter) {
        try {
          const r = await userLimiter(`user:${input.userId}`);
          if (!r.success) {
            return {
              success: false,
              remaining: r.remaining,
              limit: r.limit,
              reset: r.reset,
              scope: "user",
              retryAfterMs: Math.max(0, r.reset * 1000 - Date.now()),
            };
          }
        } catch (err) {
          logger.warn("rate_limit_backend_error", { reason: "user_error", path: input.path, err });
          return {
            success: false,
            remaining: 0,
            limit: 0,
            reset: 0,
            scope: "unconfigured",
            retryAfterMs: 0,
          };
        }
      }
    }
  }

  return {
    success: true,
    remaining: 0,
    limit: 0,
    reset: 0,
    scope: "global",
    retryAfterMs: 0,
  };
}

/**
 * Default route limits. Override individual values via env vars if needed.
 */
export const DEFAULT_ROUTE_LIMITS: RouteLimitConfig[] = [
  {
    method: "POST",
    pathPrefix: "/api/convert",
    window: process.env.RATE_LIMIT_CONVERT_WINDOW ?? "1 m",
    max: Number(process.env.RATE_LIMIT_CONVERT_PER_MIN ?? 30),
  },
  {
    method: "POST",
    pathPrefix: "/api/execute",
    window: "1 m",
    max: Number(process.env.RATE_LIMIT_EXECUTE_PER_MIN ?? 30),
  },
  {
    method: "POST",
    pathPrefix: "/api/auth/sign-up",
    window: "10 m",
    max: 5,
  },
  {
    method: "POST",
    pathPrefix: "/api/auth",
    window: "1 m",
    max: 30,
  },
  {
    method: "*",
    pathPrefix: "/api",
    window: "1 m",
    max: Number(process.env.RATE_LIMIT_API_PER_MIN ?? 120),
  },
];
