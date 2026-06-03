import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/storage/redis";
import { logger } from "./log";

/**
 * Multi-dimensional rate limiter:
 *  - Per-IP global cap (everything not in {@link ROUTE_LIMITS})
 *  - Per-(IP + route) precise caps via {@link ROUTE_LIMITS}
 *  - Per-user caps when the requester is authenticated
 *  - Sliding window algorithm (Upstash)
 *  - Fail-open mode: if Redis is unavailable we log and let the request pass
 *
 * Routes are matched by `method + path prefix`. Limits come from env vars
 * (with safe defaults) so production can tune them without code changes.
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
  // Accept "<n> <unit>" where unit in s|m|h|d. Defaults to milliseconds.
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

function makeLimiter(max: number, window: string, prefix: string): Ratelimit {
  if (!redis) {
    // This is unreachable in practice because callers gate on `redis`, but
    // TypeScript needs a safe default.
    throw new Error("Redis is not configured");
  }
  void parseWindow; // acknowledged
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, window as `${number} ${"ms" | "s" | "m" | "h" | "d"}`),
    analytics: true,
    prefix,
  });
}

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(prefix: string, max: number, window: string): Ratelimit | null {
  if (!redis) return null;
  const key = `${prefix}:${max}:${window}`;
  const cached = limiterCache.get(key);
  if (cached) return cached;
  const limiter = makeLimiter(max, window, prefix);
  limiterCache.set(key, limiter);
  return limiter;
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
  scope: "global" | "route" | "user" | "fail-open";
  retryAfterMs: number;
}

function matchRoute(
  method: string,
  path: string,
  routes: RouteLimitConfig[] = [],
): RouteLimitConfig | null {
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
 * On Redis outage the function degrades to a no-op (success: true) and logs a
 * warning. This is the "fail-open" mode described in the requirements.
 */
export async function checkRateLimit(
  input: CheckInput,
  options: RouteLimiterOptions = {},
): Promise<CheckResult> {
  const global = options.global ?? DEFAULT_GLOBAL;
  const routes = options.routes ?? [];

  if (!redis) {
    logger.warn("rate_limit_fail_open", { reason: "redis_unconfigured", path: input.path });
    return {
      success: true,
      remaining: 0,
      limit: 0,
      reset: 0,
      scope: "fail-open",
      retryAfterMs: 0,
    };
  }

  // 1. Global per-IP cap.
  const globalLimiter = getLimiter("rl:global", global.max, global.window);
  if (globalLimiter) {
    try {
      const r = await globalLimiter.limit(`ip:${input.ip}`);
      if (!r.success) {
        return {
          success: false,
          remaining: r.remaining,
          limit: r.limit,
          reset: r.reset,
          scope: "global",
          retryAfterMs: Math.max(0, r.reset - Date.now()),
        };
      }
    } catch (err) {
      logger.warn("rate_limit_fail_open", { reason: "global_error", path: input.path, err });
    }
  }

  // 2. Per-route cap.
  const route = matchRoute(input.method, input.path, routes);
  if (route) {
    const routeLimiter = getLimiter(
      `rl:route:${route.method === "*" ? "any" : route.method.toLowerCase()}:${route.pathPrefix.replace(/[^a-z0-9]+/gi, "_")}`,
      route.max,
      route.window,
    );
    if (routeLimiter) {
      try {
        const r = await routeLimiter.limit(`ip:${input.ip}`);
        if (!r.success) {
          return {
            success: false,
            remaining: r.remaining,
            limit: r.limit,
            reset: r.reset,
            scope: "route",
            retryAfterMs: Math.max(0, r.reset - Date.now()),
          };
        }
      } catch (err) {
        logger.warn("rate_limit_fail_open", { reason: "route_error", path: input.path, err });
      }
    }

    // 3. Per-user cap (authenticated only).
    if (input.userId) {
      const perUserMax = route.perUserMax ?? route.max * 4;
      const userLimiter = getLimiter(
        `rl:user:${route.pathPrefix.replace(/[^a-z0-9]+/gi, "_")}`,
        perUserMax,
        route.window,
      );
      if (userLimiter) {
        try {
          const r = await userLimiter.limit(`user:${input.userId}`);
          if (!r.success) {
            return {
              success: false,
              remaining: r.remaining,
              limit: r.limit,
              reset: r.reset,
              scope: "user",
              retryAfterMs: Math.max(0, r.reset - Date.now()),
            };
          }
        } catch (err) {
          logger.warn("rate_limit_fail_open", { reason: "user_error", path: input.path, err });
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
    max: 30,
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
