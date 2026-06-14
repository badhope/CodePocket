/**
 * @docforge/storage — 跨端 KV 存储抽象。
 * 各 app 选不同 adapter，业务代码只依赖 KV 接口。
 */

export interface KvStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, opts?: { ttlMs?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<readonly string[]>;
}

export interface KvAdapter {
  readonly id: string;
  /** 是否持久化（vs 内存） */
  readonly persistent: boolean;
  /** 配额预估（字节），NaN 表示未知 */
  quotaBytes: number;
  open(): Promise<KvStore>;
}

/** 多级缓存包装：先查 memory，再查 persistent */
export class TieredKv implements KvStore {
  constructor(
    private readonly l1: KvStore,
    private readonly l2: KvStore,
  ) {}
  async get<T = unknown>(key: string): Promise<T | null> {
    const hit = await this.l1.get<T>(key);
    if (hit !== null) return hit;
    const v = await this.l2.get<T>(key);
    if (v !== null) await this.l1.set(key, v);
    return v;
  }
  async set<T>(key: string, value: T, opts?: { ttlMs?: number }): Promise<void> {
    await Promise.all([this.l1.set(key, value, opts), this.l2.set(key, value, opts)]);
  }
  async delete(key: string): Promise<void> {
    await Promise.all([this.l1.delete(key), this.l2.delete(key)]);
  }
  async clear(): Promise<void> {
    await Promise.all([this.l1.clear(), this.l2.clear()]);
  }
  async keys(): Promise<readonly string[]> {
    const merged = new Set<string>([...(await this.l1.keys()), ...(await this.l2.keys())]);
    return [...merged];
  }
}

export { memoryAdapter } from "./adapters/memory.js";
export { h5Adapter } from "./adapters/h5.js";
export { mpAdapter } from "./adapters/mp.js";
export { appAdapter } from "./adapters/app.js";
