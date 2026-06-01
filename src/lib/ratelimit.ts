import { Ratelimit } from "@upstash/ratelimit";
import { requireRedis } from "@/lib/storage/redis";

let _executeLimit: Ratelimit | null = null;
let _apiLimit: Ratelimit | null = null;
let _authLimit: Ratelimit | null = null;

export function executeRateLimit() {
  if (_executeLimit) return _executeLimit;
  _executeLimit = new Ratelimit({
    redis: requireRedis(),
    limiter: Ratelimit.slidingWindow(
      Number(process.env.RATE_LIMIT_EXECUTE_PER_MIN ?? 30),
      "1 m",
    ),
    analytics: true,
    prefix: "rl:exec",
  });
  return _executeLimit;
}

export function apiRateLimit() {
  if (_apiLimit) return _apiLimit;
  _apiLimit = new Ratelimit({
    redis: requireRedis(),
    limiter: Ratelimit.slidingWindow(
      Number(process.env.RATE_LIMIT_API_PER_MIN ?? 120),
      "1 m",
    ),
    analytics: true,
    prefix: "rl:api",
  });
  return _apiLimit;
}

export function authRateLimit() {
  if (_authLimit) return _authLimit;
  _authLimit = new Ratelimit({
    redis: requireRedis(),
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    analytics: true,
    prefix: "rl:auth",
  });
  return _authLimit;
}

export type RateLimitResult = Awaited<ReturnType<Ratelimit["limit"]>>;
