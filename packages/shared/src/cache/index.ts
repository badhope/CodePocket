/**
 * 缓存模块 — 结果缓存与记忆化
 */

const cache = new Map<string, { value: unknown; expires: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = 60000): void {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

export function clearCache(): void {
  cache.clear();
}

// ─── 结果缓存 ─────────────────────────────────────────────

export interface ResultCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  expirations: number;
  size: number;
}

export interface ResultCacheOptions {
  max?: number;
  ttlMs?: number;
  persistent?: unknown;
  ns?: string;
}

export interface ResultCache {
  memo<T>(key: string, fn: () => T, ttlMs?: number): T;
  clear(): Promise<void>;
  stats(): ResultCacheStats;
}

export function createResultCache(options: ResultCacheOptions = {}): ResultCache {
  const max = options.max ?? 100;
  const defaultTtlMs = options.ttlMs ?? 60000;
  const stats: ResultCacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
    size: 0,
  };

  return {
    memo<T>(key: string, fn: () => T, ttlMs = defaultTtlMs): T {
      const cached = getCached<T>(key);
      if (cached !== null) {
        stats.hits++;
        return cached;
      }
      stats.misses++;
      const result = fn();
      setCached(key, result, ttlMs);
      stats.size = cache.size;
      
      // Evict if over max
      if (cache.size > max) {
        const firstKey = cache.keys().next().value;
        if (firstKey) {
          cache.delete(firstKey);
          stats.evictions++;
          stats.size = cache.size;
        }
      }
      
      return result;
    },
    async clear(): Promise<void> {
      clearCache();
      stats.size = 0;
    },
    stats(): ResultCacheStats {
      return { ...stats };
    },
  };
}

export interface MemoRunOptions {
  ttlMs?: number;
  bypass?: boolean;
}

export async function memoRun<T>(
  cacheInstance: ResultCache,
  slug: string,
  key: string,
  fn: () => Promise<T> | T,
  options?: MemoRunOptions,
): Promise<T> {
  if (options?.bypass) {
    return await fn();
  }
  
  const cacheKey = `${slug}:${key}`;
  const ttlMs = options?.ttlMs;
  
  // Check cache first
  const cached = getCached<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }
  
  const result = await fn();
  setCached(cacheKey, result, ttlMs);
  return result;
}
