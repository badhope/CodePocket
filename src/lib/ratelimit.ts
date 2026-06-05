/**
 * Domain-specific rate limiters.
 *
 * Each helper returns a (key) => Promise<Decision> function. The backing Redis
 * is chosen at runtime (Upstash for production, ioredis for local dev).
 *
 * The rate limiter factory is async (because the Upstash implementation does
 * a dynamic import). We cache the resulting function on the first call, so
 * subsequent calls return synchronously.
 */

import { rateLimit, type LimitDecision } from "@/lib/storage/redis";

type LimitFn = (key: string) => Promise<LimitDecision>;

let _convertLimit: LimitFn | null = null;
let _convertInit: Promise<LimitFn> | null = null;
let _executeLimit: LimitFn | null = null;
let _executeInit: Promise<LimitFn> | null = null;
let _streamLimit: LimitFn | null = null;
let _streamInit: Promise<LimitFn> | null = null;
let _apiLimit: LimitFn | null = null;
let _apiInit: Promise<LimitFn> | null = null;

function getOrInit(
  cacheKey: "_convertLimit" | "_executeLimit" | "_streamLimit" | "_apiLimit",
  initKey: "_convertInit" | "_executeInit" | "_streamInit" | "_apiInit",
  prefix: string,
  fallbackLimit: number,
): LimitFn | Promise<LimitFn> {
  if (cacheKey === "_convertLimit" && _convertLimit) return _convertLimit;
  if (cacheKey === "_executeLimit" && _executeLimit) return _executeLimit;
  if (cacheKey === "_streamLimit" && _streamLimit) return _streamLimit;
  if (cacheKey === "_apiLimit" && _apiLimit) return _apiLimit;

  const inFlight: Promise<LimitFn> = rateLimit({
    prefix,
    limit: fallbackLimit,
    windowMs: 60_000,
  }).then((fn) => {
    if (cacheKey === "_convertLimit") _convertLimit = fn;
    if (cacheKey === "_executeLimit") _executeLimit = fn;
    if (cacheKey === "_streamLimit") _streamLimit = fn;
    if (cacheKey === "_apiLimit") _apiLimit = fn;
    return fn;
  });
  if (initKey === "_convertInit") _convertInit = inFlight;
  if (initKey === "_executeInit") _executeInit = inFlight;
  if (initKey === "_streamInit") _streamInit = inFlight;
  if (initKey === "_apiInit") _apiInit = inFlight;
  return inFlight;
}

export function convertRateLimit(): LimitFn | Promise<LimitFn> {
  return getOrInit(
    "_convertLimit",
    "_convertInit",
    "rl:conv",
    Number(process.env.RATE_LIMIT_CONVERT_PER_MIN ?? 30),
  );
}

export function executeRateLimit(): LimitFn | Promise<LimitFn> {
  return getOrInit(
    "_executeLimit",
    "_executeInit",
    "rl:exec",
    Number(process.env.RATE_LIMIT_EXECUTE_PER_MIN ?? 20),
  );
}

export function streamRateLimit(): LimitFn | Promise<LimitFn> {
  return getOrInit(
    "_streamLimit",
    "_streamInit",
    "rl:stream",
    Number(process.env.RATE_LIMIT_STREAM_PER_MIN ?? 10),
  );
}

export function apiRateLimit(): LimitFn | Promise<LimitFn> {
  return getOrInit(
    "_apiLimit",
    "_apiInit",
    "rl:api",
    Number(process.env.RATE_LIMIT_API_PER_MIN ?? 120),
  );
}

export type RateLimitResult = LimitDecision;
