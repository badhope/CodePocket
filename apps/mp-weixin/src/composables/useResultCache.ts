/**
 * useResultCache — Vue 3 composable，跨端工具结果缓存。
 * - L1：同步内存 LRU（100 条，1h TTL）
 * - L2：uni.storage（小程序）/ localStorage（H5），通过 mpAdapter 统一
 * - 自动按 ns="docforge:cache" 隔离
 *
 * 用法：
 *   const { memo, stats, clear } = useResultCache();
 *   const out = await memo(slug, input, () => fn(input, opts), { options: opts });
 */
import { ref } from "vue";
import { createResultCache, memoRun, type ResultCache } from "@docforge/shared/cache";
import { mpAdapter } from "@docforge/storage";

const DEFAULT_MAX = 100;
const DEFAULT_TTL = 60 * 60 * 1000; // 1h

let _shared:
  | {
      cache: ResultCache;
    }
  | null = null;

async function ensureShared() {
  if (_shared) return _shared.cache;
  const l2 = await mpAdapter.open();
  const cache = createResultCache({
    max: DEFAULT_MAX,
    ttlMs: DEFAULT_TTL,
    persistent: l2,
    ns: "docforge:cache",
  });
  _shared = { cache };
  return cache;
}

export interface MemoOptions {
  options?: unknown;
  ttlMs?: number;
  bypass?: boolean;
}

export function useResultCache() {
  const stats = ref({
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
    size: 0,
  });
  let cache: ResultCache | null = null;
  let ready = false;

  ensureShared().then((c) => {
    cache = c;
    ready = true;
    stats.value = c.stats();
  });

  async function memo<T>(
    slug: string,
    input: string,
    fn: () => Promise<T> | T,
    opts?: MemoOptions,
  ): Promise<T> {
    if (!cache) {
      return await fn();
    }
    const key = `${slug}\u0000${JSON.stringify(opts?.options ?? null)}\u0000${input}`;
    const result = await memoRun(cache, slug, key, fn, {
      ttlMs: opts?.ttlMs,
      bypass: opts?.bypass,
    });
    stats.value = cache.stats();
    return result;
  }

  async function clear(): Promise<void> {
    if (cache) await cache.clear();
    stats.value = cache?.stats() ?? stats.value;
  }

  return { memo, stats, clear, get isReady() { return ready; } };
}
