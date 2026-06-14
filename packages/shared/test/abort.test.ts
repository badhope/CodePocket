/**
 * M2.3 — AbortSignal 集成测试。
 * 覆盖 execution / convert / abort utils 三个面。
 */
import { describe, it, expect } from "vitest";
import {
  AbortError,
  throwIfAborted,
  withAbort,
  linkAbort,
  delay,
  PistonBackend,
  PyodideBackend,
  WorkerBackend,
  convert,
  type ConvertResult,
} from "../src/index.js";

describe("abort utils", () => {
  it("throwIfAborted throws when signal is aborted", () => {
    const c = new AbortController();
    c.abort("oops");
    expect(() => throwIfAborted(c.signal)).toThrowError(AbortError);
  });
  it("throwIfAborted is a no-op when no signal", () => {
    expect(() => throwIfAborted()).not.toThrow();
  });
  it("withAbort stops iteration when signal aborts", async () => {
    const c = new AbortController();
    async function* src() {
      yield 1;
      yield 2;
      yield 3;
    }
    const out: number[] = [];
    const it = withAbort(src(), c.signal)[Symbol.asyncIterator]();
    let next = await it.next();
    out.push(next.value as number);
    c.abort("stop");
    await expect(it.next()).rejects.toThrowError(AbortError);
    expect(out).toEqual([1]);
  });
  it("linkAbort aborts child when parent aborts", () => {
    const parent = new AbortController();
    const child = new AbortController();
    linkAbort(parent.signal, child);
    parent.abort("parent-cancel");
    expect(child.signal.aborted).toBe(true);
  });
  it("delay rejects on abort", async () => {
    const c = new AbortController();
    const p = delay(500, c.signal);
    c.abort("now");
    await expect(p).rejects.toThrowError(AbortError);
  });
});

describe("PistonBackend.stream with abort", () => {
  it("aborts an in-flight stream request and yields error event", async () => {
    const backend = new PistonBackend({
      baseUrl: "https://nonexistent.docforge.invalid",
      timeoutMs: 200,
    });
    const c = new AbortController();
    const events: string[] = [];
    const it = backend.stream(
      { language: "python", files: [{ name: "a.py", content: "print(1)" }] },
      c.signal,
    )[Symbol.asyncIterator]();
    // 主动 abort
    setTimeout(() => c.abort("test"), 5);
    for (;;) {
      const next = await it.next();
      if (next.done) break;
      const ev = next.value as { type: string };
      events.push(ev.type);
      if (ev.type === "error") break;
    }
    expect(events).toContain("error");
  });
});

describe("PyodideBackend.execute with abort", () => {
  it("rejects with AbortError when signal pre-aborted", async () => {
    const backend = new PyodideBackend({ indexUrl: "https://x.invalid/" });
    const c = new AbortController();
    c.abort("nope");
    await expect(
      backend.execute({ language: "python", files: [{ name: "a.py", content: "1" }] }, c.signal),
    ).rejects.toThrowError(AbortError);
  });
});

describe("WorkerBackend.execute with abort", () => {
  it("throws AbortError when signal pre-aborted (no worker spawn)", async () => {
    // 故意给一个无效 worker url：signal 预 abort 应当先抛错
    const backend = new WorkerBackend({ workerUrl: new URL("data:,") });
    const c = new AbortController();
    c.abort("nope");
    await expect(
      backend.execute({ language: "javascript", files: [{ name: "a.js", content: "1" }] }, c.signal),
    ).rejects.toThrowError(AbortError);
  });
});

describe("convert with AbortSignal", () => {
  it("returns aborted result when signal pre-aborted", async () => {
    const c = new AbortController();
    c.abort("user cancel");
    const r: ConvertResult = await convert("# x", "md", "html", { signal: c.signal });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.aborted).toBe(true);
      expect(r.error).toBe("aborted");
    }
  });
  it("passes signal through to backend converter", async () => {
    let receivedSignal: AbortSignal | undefined;
    const c = new AbortController();
    const r: ConvertResult = await convert("xxx", "docx", "html", {
      signal: c.signal,
      backend: {
        async convert(from, to, input, onProgress, signal) {
          receivedSignal = signal;
          void from;
          void to;
          void input;
          void onProgress;
          // 在 backend 内触发 abort 模拟中途取消
          setTimeout(() => c.abort("user cancel mid-way"), 0);
          return { ok: true, output: "ok", mime: "text/html", pair: { from, to, local: false, hint: "backend" } };
        },
      },
    });
    expect(receivedSignal).toBeDefined();
    expect(r.ok).toBe(true);
  });
  it("finishes quickly when no signal is supplied", async () => {
    const r: ConvertResult = await convert("# hello", "md", "html");
    expect(r.ok).toBe(true);
  });
});
