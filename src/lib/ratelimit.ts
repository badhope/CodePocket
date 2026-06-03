import { Ratelimit } from "@upstash/ratelimit";
import { requireRedis } from "@/lib/storage/redis";

let _convertLimit: Ratelimit | null = null;
let _apiLimit: Ratelimit | null = null;

export function convertRateLimit() {
  if (_convertLimit) return _convertLimit;
  _convertLimit = new Ratelimit({
    redis: requireRedis(),
    limiter: Ratelimit.slidingWindow(
      Number(process.env.RATE_LIMIT_CONVERT_PER_MIN ?? 30),
      "1 m",
    ),
    analytics: true,
    prefix: "rl:conv",
  });
  return _convertLimit;
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

export type RateLimitResult = Awaited<ReturnType<Ratelimit["limit"]>>;