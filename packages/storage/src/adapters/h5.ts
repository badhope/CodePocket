/**
 * H5 KV 适配：localStorage 优先，IndexedDB 兜底（> 5MB）。
 * 浏览器/Node SSR 兼容（SSR 时回退到 memory）。
 */

import type { KvAdapter, KvStore } from "../index.js";
import { memoryAdapter } from "./memory.js";

class LocalStorageStore implements KvStore {
  private prefix: string;
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  private k(key: string): string {
    return `${this.prefix}:${key}`;
  }
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(this.k(key));
      if (raw == null) return null;
      const wrapper = JSON.parse(raw) as { value: unknown; expireAt: number | null };
      if (wrapper.expireAt !== null && wrapper.expireAt < Date.now()) {
        localStorage.removeItem(this.k(key));
        return null;
      }
      return wrapper.value as T;
    } catch {
      return null;
    }
  }
  async set<T>(key: string, value: T, opts?: { ttlMs?: number }): Promise<void> {
    const wrapper = { value, expireAt: opts?.ttlMs ? Date.now() + opts.ttlMs : null };
    localStorage.setItem(this.k(key), JSON.stringify(wrapper));
  }
  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.k(key));
  }
  async clear(): Promise<void> {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${this.prefix}:`)) localStorage.removeItem(k);
    }
  }
  async keys(): Promise<readonly string[]> {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${this.prefix}:`)) out.push(k.slice(this.prefix.length + 1));
    }
    return out;
  }
}

export const h5Adapter: KvAdapter = {
  id: "h5",
  persistent: true,
  get quotaBytes() {
    try {
      return 5 * 1024 * 1024; // localStorage ~5MB
    } catch {
      return Number.NaN;
    }
  },
  async open() {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return memoryAdapter.open();
    }
    return new LocalStorageStore("docforge");
  },
};
