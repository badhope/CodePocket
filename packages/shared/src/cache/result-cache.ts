/**
 * 工具结果缓存。
 *
 * 用法（典型）：
 *   const cache = createResultCache({ max: 100, ttlMs: 60 * 60 * 1000 });
 *   const out = await memoRun(cache, "json-formatter", input, () => formatJson(input));
 *
 * - LRU 在内存里（同步访问，O(1)）。
 * - 可选 persistent backend（@docforge/storage 的 KvStore）— 用于跨刷新保持。
 * - key 用 `fastKey(slug, input)`（FNV-1a，32-bit）。
 *
 * 设计原则：
 * 1. 同步 LRU 一层；持久 KV 一层（异步）。
 * 2. 命中：L1 hit → 直接返；L1 miss → L2.get → 回填 L1。
 * 3. set：先写 L1（同步），再异步写 L2（fire-and-forget，避免阻塞工具调用）。
 * 4. stats：单独一个 snapshot 对象，UI 拿它显示"x 缓存命中 / y 总请求"。
 */

import { Lru } from "./lru.js";
import { fastKey } from "./hash.js";

/**
 * 持久层接口的最小形状（与 @docforge/storage 的 KvStore 结构兼容）。
 * 这里重复定义是为了让 @docforge/shared 运行时**不依赖** @docforge/storage——
 * 任何实现 `get/set/delete/clear/keys` 五个方法的对象都能作为持久层传入。
 */
export interface KvStoreLike {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, opts?: { ttlMs?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<readonly string[]>;
}

export interface ResultCacheOptions {
  /** LRU 容量。默认 100 */
  max?: number;
  /** 默认 TTL（ms）。默认 1h */
  ttlMs?: number;
  /** 可选持久层（IndexedDB / localStorage） */
  persistent?: KvStoreLike;
  /** 命名前缀（避免不同 app 串） */
  ns?: string;
  /** 时钟源（测试用） */
  now?: () => number;
  /** 调试：get/set 钩子 */
  onHit?: (key: string) => void;
  onMiss?: (key: string) => void;
  onSet?: (key: string) => void;
}

export interface ResultCache {
  /** L1 同步读 */
  getSync(key: string): unknown | undefined;
  /** 同步写 L1 */
  setSync(key: string, value: unknown, opts?: { ttlMs?: number }): void;
  /** 异步读（L1 miss 后走 L2，再回填 L1） */
  get(key: string): Promise<unknown | undefined>;
  /** 异步写（L1 + L2 fire-and-forget） */
  set(key: string, value: unknown, opts?: { ttlMs?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  stats(): { hits: number; misses: number; evictions: number; expirations: number; size: number };
  /** 内部 LRU 实例（用于 inspect） */
  readonly lru: Lru<unknown>;
}

const DEFAULT_MAX = 100;
const DEFAULT_TTL = 60 * 60 * 1000; // 1h

export function createResultCache(opts: ResultCacheOptions = {}): ResultCache {
  const lru = new Lru<unknown>({
    max: opts.max ?? DEFAULT_MAX,
    ttlMs: opts.ttlMs ?? DEFAULT_TTL,
    now: opts.now,
  });
  const ns = opts.ns ? `${opts.ns}:` : "";
  const l2 = opts.persistent;
  const onHit = opts.onHit;
  const onMiss = opts.onMiss;
  const onSet = opts.onSet;

  function fullKey(raw: string): string {
    return `${ns}${raw}`;
  }

  return {
    lru,

    getSync(key) {
      const v = lru.get(fullKey(key));
      if (v !== undefined) onHit?.(key);
      else onMiss?.(key);
      return v;
    },

    setSync(key, value, o) {
      lru.set(fullKey(key), value, o);
      onSet?.(key);
      if (l2) {
        // 异步写持久层，错误吞掉（不阻塞主流程）
        void l2.set(fullKey(key), value, o).catch(() => {
          /* ignore */
        });
      }
    },

    async get(key) {
      const fk = fullKey(key);
      const v = lru.get(fk);
      if (v !== undefined) {
        onHit?.(key);
        return v;
      }
      // L1 miss → 查 L2
      if (l2) {
        try {
          const fromL2 = await l2.get(fk);
          if (fromL2 !== null) {
            lru.set(fk, fromL2);
            onHit?.(key);
            return fromL2;
          }
        } catch {
          /* 持久层错误不影响主流程 */
        }
      }
      onMiss?.(key);
      return undefined;
    },

    async set(key, value, o) {
      const fk = fullKey(key);
      lru.set(fk, value, o);
      onSet?.(key);
      if (l2) {
        try {
          await l2.set(fk, value, o);
        } catch {
          /* ignore */
        }
      }
    },

    async delete(key) {
      lru.delete(fullKey(key));
      if (l2) {
        try {
          await l2.delete(fullKey(key));
        } catch {
          /* ignore */
        }
      }
    },

    async clear() {
      lru.clear();
      if (l2) {
        try {
          await l2.clear();
        } catch {
          /* ignore */
        }
      }
    },

    stats() {
      return {
        hits: lru.stats.hits,
        misses: lru.stats.misses,
        evictions: lru.stats.evictions,
        expirations: lru.stats.expirations,
        size: lru.size,
      };
    },
  };
}

/**
 * 高阶 helper：先查缓存，miss 时跑 fn，set 后返回。
 *
 * 注意：fn 抛错时不写缓存（避免错误值污染）。
 */
export async function memoRun<T>(
  cache: ResultCache,
  slug: string,
  input: string,
  fn: () => Promise<T> | T,
  opts?: { ttlMs?: number; bypass?: boolean },
): Promise<T> {
  if (opts?.bypass) return await fn();
  const key = fastKey(slug, input);
  const hit = await cache.get(key);
  if (hit !== undefined) return hit as T;
  const result = await fn();
  await cache.set(key, result, opts);
  return result;
}

/** LruOptions 重导出，方便使用方 */
export type { LruOptions } from "./lru.js";
