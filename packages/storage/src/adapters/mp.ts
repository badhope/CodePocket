/**
 * 小程序 KV 适配：uni.setStorageSync / uni.getStorageSync（兼容微信/支付宝/抖音/百度）。
 * 若未运行在 uni 环境下，回退到 memory。
 */

import type { KvAdapter, KvStore } from "../index.js";
import { memoryAdapter } from "./memory.js";

interface UniStorage {
  setStorageSync(key: string, data: unknown): void;
  getStorageSync(key: string): unknown;
  removeStorageSync(key: string): void;
  clearStorageSync?(): void;
  getStorageInfoSync?(): { keys: string[] };
}

function getUni(): { storage: UniStorage } | null {
  if (typeof globalThis === "undefined") return null;
  const u = (globalThis as { uni?: unknown }).uni;
  if (!u) return null;
  const storage = (u as { setStorageSync?: UniStorage["setStorageSync"] }).setStorageSync
    ? (u as unknown as UniStorage)
    : null;
  return storage ? { storage } : null;
}

class MpStore implements KvStore {
  private prefix: string;
  constructor(
    prefix: string,
    private readonly uni: UniStorage,
  ) {
    this.prefix = prefix;
  }
  private k(key: string): string {
    return `${this.prefix}:${key}`;
  }
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = this.uni.getStorageSync(this.k(key));
      if (raw == null) return null;
      const wrapper = raw as { value: unknown; expireAt: number | null };
      if (wrapper.expireAt !== null && wrapper.expireAt < Date.now()) {
        this.uni.removeStorageSync(this.k(key));
        return null;
      }
      return wrapper.value as T;
    } catch {
      return null;
    }
  }
  async set<T>(key: string, value: T, opts?: { ttlMs?: number }): Promise<void> {
    const wrapper = { value, expireAt: opts?.ttlMs ? Date.now() + opts.ttlMs : null };
    this.uni.setStorageSync(this.k(key), wrapper);
  }
  async delete(key: string): Promise<void> {
    this.uni.removeStorageSync(this.k(key));
  }
  async clear(): Promise<void> {
    this.uni.clearStorageSync?.();
  }
  async keys(): Promise<readonly string[]> {
    const info = this.uni.getStorageInfoSync?.();
    if (!info) return [];
    return info.keys
      .filter((k) => k.startsWith(`${this.prefix}:`))
      .map((k) => k.slice(this.prefix.length + 1));
  }
}

export const mpAdapter: KvAdapter = {
  id: "mp",
  persistent: true,
  get quotaBytes() {
    try {
      return 10 * 1024 * 1024;
    } catch {
      return Number.NaN;
    }
  },
  async open() {
    const u = getUni();
    if (!u) return memoryAdapter.open();
    return new MpStore("docforge", u.storage);
  },
};
