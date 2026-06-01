import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as { redis: Redis | null };

function buildClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export const redis: Redis | null = globalForRedis.redis ?? buildClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export function requireRedis(): Redis {
  if (!redis) {
    throw new Error(
      "Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }
  return redis;
}
