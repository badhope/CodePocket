/**
 * Unified Redis client + rate-limiter abstraction.
 *
 * - Production: Upstash REST Redis (HTTP, edge-friendly).
 * - Local dev: ioredis talking to a self-hosted Redis 7.
 * - Fallback: In-memory rate limiter (no Redis required).
 *
 * The same redis backend can be plugged into @upstash/ratelimit by adapting
 * the local ioredis client to the @upstash/redis interface shape.
 */

import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis, { type Redis as IORedisType } from "ioredis";

const globalForRedis = globalThis as unknown as {
  upstash: UpstashRedis | null;
  local: IORedisType | null;
};

export type LimitDecision = {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
};

export type LimitFn = (key: string) => Promise<LimitDecision>;

export type Backend = "upstash" | "local" | "memory" | "none";

// ---------------------------------------------------------------------------
// Client construction
// ---------------------------------------------------------------------------

function buildUpstash(): UpstashRedis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new UpstashRedis({ url, token });
}

function buildLocal(): IORedisType | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    // Non-fatal: rate limiters will report failure to the caller.
    console.warn("[redis:local] error", err.message);
  });
  return client;
}

export const upstash: UpstashRedis | null = globalForRedis.upstash ?? buildUpstash();
export const local: IORedisType | null = globalForRedis.local ?? buildLocal();
if (process.env.NODE_ENV !== "production") {
  globalForRedis.upstash = upstash;
  globalForRedis.local = local;
}

export function backend(): Backend {
  if (upstash) return "upstash";
  if (local) return "local";
  return "memory"; // Fallback to in-memory
}

// ---------------------------------------------------------------------------
// In-memory rate limiter (fallback when no Redis)
// ---------------------------------------------------------------------------

const memoryStore = new Map<string, { timestamps: number[]; expires: number }>();

function slidingWindowMemory(key: string, limit: number, windowMs: number): LimitDecision {
  const now = Date.now();
  const cutoff = now - windowMs;
  
  let entry = memoryStore.get(key);
  if (!entry || entry.expires < now) {
    entry = { timestamps: [], expires: now + windowMs };
    memoryStore.set(key, entry);
  }
  
  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);
  
  const count = entry.timestamps.length;
  if (count >= limit) {
    const oldest = entry.timestamps[0];
    return {
      success: false,
      remaining: 0,
      reset: Math.floor((oldest + windowMs) / 1000),
      limit,
    };
  }
  
  entry.timestamps.push(now);
  return {
    success: true,
    remaining: limit - count - 1,
    reset: Math.floor((now + windowMs) / 1000),
    limit,
  };
}

// ---------------------------------------------------------------------------
// Rate limiter factory
// ---------------------------------------------------------------------------

/**
 * Return a rate-limit function that talks to whichever backend is available.
 * Falls back to in-memory rate limiting if no Redis is configured.
 */
export async function rateLimit(opts: { prefix: string; limit: number; windowMs: number }): Promise<LimitFn> {
  const { prefix, limit, windowMs } = opts;
  if (upstash) {
    // Lazy import so the production bundle never pulls in @upstash/ratelimit
    // when only a local backend is configured. We use a dynamic import via
    // createRequire so the import is truly deferred to call-time.
    const { createRequire } = await import("node:module");
    const dynamicRequire = createRequire(import.meta.url);
    const mod = dynamicRequire("@upstash/ratelimit") as typeof import("@upstash/ratelimit");
    const { Ratelimit } = mod;
    const r = new Ratelimit({
      redis: upstash,
      limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.round(windowMs / 1000))} s`),
      prefix,
    });
    return async (key: string) => {
      const res = await r.limit(key);
      const resetValue: number =
        typeof res.reset === "number" ? res.reset : Math.floor((res.reset as Date).getTime() / 1000);
      return {
        success: res.success,
        remaining: res.remaining,
        reset: resetValue,
        limit: res.limit,
      };
    };
  }
  if (local) {
    return async (key: string) => slidingWindowLocal(local, `${prefix}:${key}`, limit, windowMs);
  }
  // Fallback to in-memory rate limiting
  return async (key: string) => slidingWindowMemory(`${prefix}:${key}`, limit, windowMs);
}

/**
 * Sliding-window log rate limit implemented in Lua for atomicity against a
 * vanilla Redis (works on Redis 7+).
 */
async function slidingWindowLocal(
  client: IORedisType,
  key: string,
  limit: number,
  windowMs: number,
): Promise<LimitDecision> {
  const lua = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local cutoff = now - window
redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset = (tonumber(oldest[2]) + window)
  return {0, limit - count, reset}
end
redis.call('ZADD', key, now, now .. ':' .. math.random())
redis.call('PEXPIRE', key, window)
return {1, limit - count - 1, now + window}
`;
  const now = Date.now();
  const result = (await client.eval(lua, 1, key, String(now), String(windowMs), String(limit))) as [
    number,
    number,
    number,
  ];
  const [success, remaining, resetMs] = result;
  return {
    success: success === 1,
    remaining,
    reset: Math.floor(resetMs / 1000),
    limit,
  };
}

// ---------------------------------------------------------------------------
// Backwards-compat shim
// ---------------------------------------------------------------------------

/**
 * @deprecated prefer rateLimit(). Kept for callers that have not migrated yet.
 * Returns in-memory implementation if no Redis is configured.
 */
export function requireRedis(): UpstashRedis | IORedisType | null {
  if (upstash) return upstash;
  if (local) return local;
  return null; // No Redis available, use in-memory rate limiting
}
