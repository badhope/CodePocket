/**
 * M2.4 工具结果缓存 — 单元测试。
 * 覆盖：LRU 淘汰 / TTL 过期 / fastKey 稳定 / memoRun 命中 / 持久层模拟 / 错误不入缓存
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Lru, fastKey, fnv1aHex, createResultCache, memoRun, sha256 } from "../src/cache/index.js";

describe("Lru", () => {
  it("basic get/set", () => {
    const lru = new Lru<number>({ max: 3 });
    lru.set("a", 1);
    lru.set("b", 2);
    expect(lru.get("a")).toBe(1);
    expect(lru.get("b")).toBe(2);
    expect(lru.get("c")).toBeUndefined();
    expect(lru.stats.hits).toBe(2);
    expect(lru.stats.misses).toBe(1);
  });

  it("evicts LRU when over max", () => {
    const lru = new Lru<string>({ max: 2 });
    lru.set("a", "A");
    lru.set("b", "B");
    lru.get("a"); // touch a
    lru.set("c", "C"); // should evict b
    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(false);
    expect(lru.stats.evictions).toBe(1);
  });

  it("expires after ttlMs (lazy)", () => {
    let now = 1000;
    const lru = new Lru<number>({ max: 10, ttlMs: 500, now: () => now });
    lru.set("k", 42);
    expect(lru.get("k")).toBe(42);
    now = 1400;
    expect(lru.get("k")).toBe(42);
    now = 1500; // 过了 500ms 阈值
    expect(lru.get("k")).toBeUndefined();
    expect(lru.stats.expirations).toBe(1);
  });

  it("set with explicit ttl override", () => {
    let now = 0;
    const lru = new Lru<number>({ max: 10, ttlMs: 0, now: () => now });
    lru.set("forever", 1);
    lru.set("short", 2, { ttlMs: 100 });
    now = 200;
    expect(lru.get("forever")).toBe(1);
    expect(lru.get("short")).toBeUndefined();
  });

  it("clear() empties", () => {
    const lru = new Lru<number>({ max: 3 });
    lru.set("a", 1);
    lru.set("b", 2);
    lru.clear();
    expect(lru.size).toBe(0);
    expect(lru.get("a")).toBeUndefined();
  });
});

describe("fastKey + fnv1aHex", () => {
  it("returns stable hex key", () => {
    const a = fastKey("json-formatter", `{"x":1}`);
    const b = fastKey("json-formatter", `{"x":1}`);
    expect(a).toBe(b);
    expect(a).toMatch(/^json-formatter::[0-9a-f]{8}$/);
  });

  it("different inputs → different keys", () => {
    expect(fastKey("s", "a")).not.toBe(fastKey("s", "b"));
    expect(fastKey("a", "x")).not.toBe(fastKey("b", "x"));
  });

  it("fnv1aHex is 8 hex chars", () => {
    expect(fnv1aHex("hello")).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("createResultCache + memoRun", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("memoRun hits cache after first run", async () => {
    const cache = createResultCache({ max: 10, ttlMs: 60_000 });
    const fn = vi.fn(async (s: string) => `out:${s.toUpperCase()}`);

    const a = await memoRun(cache, "slug", "hello", () => fn("hello"));
    const b = await memoRun(cache, "slug", "hello", () => fn("hello"));

    expect(a).toBe("out:HELLO");
    expect(b).toBe("out:HELLO");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(cache.stats().hits).toBe(1);
    expect(cache.stats().misses).toBe(1);
  });

  it("bypass option skips cache", async () => {
    const cache = createResultCache({ max: 10 });
    const fn = vi.fn(async () => 42);
    await memoRun(cache, "x", "y", fn);
    await memoRun(cache, "x", "y", fn, { bypass: true });
    await memoRun(cache, "x", "y", fn, { bypass: true });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not cache thrown errors", async () => {
    const cache = createResultCache({ max: 10 });
    const fn = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(memoRun(cache, "x", "y", fn)).rejects.toThrow("boom");
    // 第二次还会再调（不入缓存）
    await expect(memoRun(cache, "x", "y", fn)).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("falls back gracefully when persistent backend fails", async () => {
    const l2 = {
      get: vi.fn().mockRejectedValue(new Error("L2 down")),
      set: vi.fn().mockRejectedValue(new Error("L2 down")),
      delete: vi.fn().mockRejectedValue(new Error("L2 down")),
      clear: vi.fn().mockRejectedValue(new Error("L2 down")),
      keys: vi.fn().mockRejectedValue(new Error("L2 down")),
    };
    const cache = createResultCache({ max: 10, persistent: l2 });
    await cache.set("k", "v");
    expect(l2.set).toHaveBeenCalled();
    // get 应该只走 L1（同步），不调 l2
    expect(cache.getSync("k")).toBe("v");
  });

  it("get() reads from L2 on L1 miss and backfills L1", async () => {
    const stored = new Map<string, unknown>();
    const l2 = {
      get: vi.fn(async (k: string) => stored.get(k) ?? null),
      set: vi.fn(async (k: string, v: unknown) => {
        stored.set(k, v);
      }),
      delete: vi.fn(async (k: string) => {
        stored.delete(k);
      }),
      clear: vi.fn(async () => {
        stored.clear();
      }),
      keys: vi.fn(async () => [...stored.keys()]),
    };
    const cache = createResultCache({ max: 10, persistent: l2 });
    // 预填 L2（模拟上次会话留下的值）
    const key = fastKey("slug", "input");
    await l2.set(key, "from-L2");

    const v = await cache.get(key);
    expect(v).toBe("from-L2");
    // L1 也应该被回填
    expect(cache.getSync(key)).toBe("from-L2");
  });

  it("ns prefix isolates caches", async () => {
    const a = createResultCache({ max: 5, ns: "appA" });
    const b = createResultCache({ max: 5, ns: "appB" });
    a.setSync("k", "fromA");
    expect(b.getSync("k")).toBeUndefined();
  });
});

describe("sha256", () => {
  it("produces 64 hex chars (browser subtle or fnv fallback)", async () => {
    const h = await sha256("hello");
    expect(h).toMatch(/^[0-9a-f]{8,64}$/);
  });
});
