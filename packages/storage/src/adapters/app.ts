/**
 * App (Android/iOS) KV 适配：uni.storage（uni-app x）→ SQLite 兜底。
 * 同时支持原生偏好：plus.storage (5+ App) / NSUserDefaults / SharedPreferences。
 * 运行时未注入时回退到 memory。
 */

import type { KvAdapter, KvStore } from "../index.js";
import { memoryAdapter } from "./memory.js";

interface AppKv {
  setItem(key: string, value: string, cb?: (err: Error | null) => void): void;
  getItem(key: string, cb: (err: Error | null, value: string | null) => void): void;
  removeItem(key: string, cb?: (err: Error | null) => void): void;
  clear?(cb?: (err: Error | null) => void): void;
  getAllKeys?(cb: (err: Error | null, keys: string[]) => void): void;
}

interface RuntimeKv {
  getKv?(): AppKv | null;
}

function getAppKv(): AppKv | null {
  if (typeof globalThis === "undefined") return null;
  const r =
    (globalThis as { plus?: RuntimeKv; uni?: RuntimeKv }).plus ?? (globalThis as { uni?: RuntimeKv }).uni;
  return r?.getKv?.() ?? null;
}

class AppStore implements KvStore {
  private prefix: string;
  constructor(
    prefix: string,
    private readonly kv: AppKv,
  ) {
    this.prefix = prefix;
  }
  private k(key: string): string {
    return `${this.prefix}:${key}`;
  }
  async get<T = unknown>(key: string): Promise<T | null> {
    return new Promise((resolve) => {
      this.kv.getItem(this.k(key), (_err, raw) => {
        if (raw == null) {
          resolve(null);
          return;
        }
        try {
          const wrapper = JSON.parse(raw) as { value: unknown; expireAt: number | null };
          if (wrapper.expireAt !== null && wrapper.expireAt < Date.now()) {
            this.kv.removeItem(this.k(key));
            resolve(null);
            return;
          }
          resolve(wrapper.value as T);
        } catch {
          resolve(null);
        }
      });
    });
  }
  async set<T>(key: string, value: T, opts?: { ttlMs?: number }): Promise<void> {
    const wrapper = { value, expireAt: opts?.ttlMs ? Date.now() + opts.ttlMs : null };
    return new Promise((resolve, reject) => {
      this.kv.setItem(this.k(key), JSON.stringify(wrapper), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  async delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.kv.removeItem(this.k(key), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  async clear(): Promise<void> {
    if (!this.kv.clear) return;
    return new Promise((resolve, reject) => {
      this.kv.clear?.((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
  async keys(): Promise<readonly string[]> {
    if (!this.kv.getAllKeys) return [];
    return new Promise((resolve) => {
      this.kv.getAllKeys?.((_err, keys) => {
        resolve(
          keys.filter((k) => k.startsWith(`${this.prefix}:`)).map((k) => k.slice(this.prefix.length + 1)),
        );
      });
    });
  }
}

export const appAdapter: KvAdapter = {
  id: "app",
  persistent: true,
  get quotaBytes() {
    return Number.NaN;
  },
  async open() {
    const kv = getAppKv();
    if (!kv) return memoryAdapter.open();
    return new AppStore("docforge", kv);
  },
};
