/**
 * 框架无关 LRU 缓存（双向链表 + Map）。
 * - size 限制条目数（不是字节数）
 * - ttlMs：写入后过期时间（ms）。0 = 永不过期
 * - get 时 lazy 清理过期
 * - 同步 API：单线程 JS 适用
 *
 * 用法：
 *   const lru = new Lru<MyValue>({ max: 100, ttlMs: 60 * 60 * 1000 });
 *   lru.set("k", value);
 *   const v = lru.get("k");   // 过期返回 undefined
 */
export interface LruOptions {
  /** 最大条目数。超出则按 LRU 淘汰最久未访问的 */
  max: number;
  /** 默认 TTL（ms）。get / set 时可单次覆盖 */
  ttlMs?: number;
  /** 时钟源（便于测试） */
  now?: () => number;
}

interface Entry<V> {
  value: V;
  expires: number; // 0 = never
}

export class Lru<V> {
  private readonly map = new Map<string, Entry<V> & { key: string }>();
  private readonly now: () => number;
  private readonly defaultTtlMs: number;
  private readonly max: number;
  /** 命中 / 未命中 / 淘汰 / 过期 计数（便于测试 + UI 展示） */
  readonly stats = { hits: 0, misses: 0, evictions: 0, expirations: 0 };

  constructor(opts: LruOptions) {
    this.max = opts.max;
    this.defaultTtlMs = opts.ttlMs ?? 0;
    this.now = opts.now ?? Date.now;
  }

  get size(): number {
    return this.map.size;
  }

  /** 取值。命中后移到队尾。 */
  get(key: string): V | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.stats.misses++;
      return undefined;
    }
    if (entry.expires > 0 && this.now() >= entry.expires) {
      this.map.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      return undefined;
    }
    // LRU touch: 重建再插入以更新顺序
    this.map.delete(key);
    this.map.set(key, entry);
    this.stats.hits++;
    return entry.value;
  }

  /** 设值。超 max 时按 LRU 淘汰最旧。 */
  set(key: string, value: V, opts?: { ttlMs?: number }): void {
    const ttl = opts?.ttlMs ?? this.defaultTtlMs;
    const expires = ttl > 0 ? this.now() + ttl : 0;
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expires, key });
    // 淘汰
    while (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value as string | undefined;
      if (firstKey === undefined) break;
      this.map.delete(firstKey);
      this.stats.evictions++;
    }
  }

  has(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (entry.expires > 0 && this.now() >= entry.expires) {
      this.map.delete(key);
      this.stats.expirations++;
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  keys(): string[] {
    return [...this.map.keys()];
  }
}
