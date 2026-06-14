/**
 * 内存 KV（用于测试 / SSR / 临时缓存）— 框架无关。
 */

import type { KvAdapter, KvStore } from "../index.js";

class MemoryStore implements KvStore {
  private readonly map = new Map<string, { value: unknown; expireAt: number | null }>();
  async get<T = unknown>(key: string): Promise<T | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expireAt !== null && e.expireAt < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return e.value as T;
  }
  async set<T>(key: string, value: T, opts?: { ttlMs?: number }): Promise<void> {
    this.map.set(key, {
      value,
      expireAt: opts?.ttlMs ? Date.now() + opts.ttlMs : null,
    });
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
  async clear(): Promise<void> {
    this.map.clear();
  }
  async keys(): Promise<readonly string[]> {
    return [...this.map.keys()];
  }
}

export const memoryAdapter: KvAdapter = {
  id: "memory",
  persistent: false,
  quotaBytes: Number.NaN,
  async open() {
    return new MemoryStore();
  },
};
