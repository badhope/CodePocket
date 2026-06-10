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
type LimitName = "convert" | "execute" | "stream" | "api";

const cache: Partial<Record<LimitName, LimitFn>> = {};
const inFlight: Partial<Record<LimitName, Promise<LimitFn>>> = {};

function getOrInit(name: LimitName, prefix: string, fallbackLimit: number): LimitFn | Promise<LimitFn> {
  const cached = cache[name];
  if (cached) return cached;
  const pending = inFlight[name];
  if (pending) return pending;
  const promise: Promise<LimitFn> = rateLimit({
    prefix,
    limit: fallbackLimit,
    windowMs: 60_000,
  }).then((fn) => {
    cache[name] = fn;
    delete inFlight[name];
    return fn;
  });
  inFlight[name] = promise;
  return promise;
}

export function convertRateLimit(): LimitFn | Promise<LimitFn> {
  return getOrInit("convert", "rl:conv", Number(process.env.RATE_LIMIT_CONVERT_PER_MIN ?? 30));
}

export function executeRateLimit(): LimitFn | Promise<LimitFn> {
  return getOrInit("execute", "rl:exec", Number(process.env.RATE_LIMIT_EXECUTE_PER_MIN ?? 20));
}

export function streamRateLimit(): LimitFn | Promise<LimitFn> {
  return getOrInit("stream", "rl:stream", Number(process.env.RATE_LIMIT_STREAM_PER_MIN ?? 10));
}

export function apiRateLimit(): LimitFn | Promise<LimitFn> {
  return getOrInit("api", "rl:api", Number(process.env.RATE_LIMIT_API_PER_MIN ?? 120));
}

export type RateLimitResult = LimitDecision;
