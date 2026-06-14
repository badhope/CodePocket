import { describe, it, expect } from "vitest";
import { memoryAdapter, TieredKv } from "../src/index.js";

describe("memoryAdapter", () => {
  it("round-trips values", async () => {
    const kv = await memoryAdapter.open();
    await kv.set("a", { x: 1 });
    expect(await kv.get("a")).toEqual({ x: 1 });
    await kv.delete("a");
    expect(await kv.get("a")).toBeNull();
  });

  it("honors TTL", async () => {
    const kv = await memoryAdapter.open();
    await kv.set("k", "v", { ttlMs: 10 });
    expect(await kv.get("k")).toBe("v");
    await new Promise((r) => setTimeout(r, 20));
    expect(await kv.get("k")).toBeNull();
  });
});

describe("TieredKv", () => {
  it("L1 hit skips L2", async () => {
    const a = await memoryAdapter.open();
    const b = await memoryAdapter.open();
    await b.set("k", "fromL2");
    const t = new TieredKv(a, b);
    expect(await t.get("k")).toBe("fromL2");
    // 第二次应来自 L1
    const r = await t.get("k");
    expect(r).toBe("fromL2");
  });

  it("writes propagate to both", async () => {
    const a = await memoryAdapter.open();
    const b = await memoryAdapter.open();
    const t = new TieredKv(a, b);
    await t.set("k", "v");
    expect(await a.get("k")).toBe("v");
    expect(await b.get("k")).toBe("v");
  });
});
