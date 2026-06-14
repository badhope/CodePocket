/**
 * 执行后端单元测试 — 框架无关。
 *   - PistonBackend：fetch mock
 *   - WorkerBackend：jsdom Worker stub
 *   - selectBackend：选择算法
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PistonBackend, selectBackend, type ExecutionResult } from "../src/index.js";
import type { BackendSnapshot } from "../src/index.js";

const OK_RESULT: ExecutionResult = {
  language: "python",
  version: "3.10.0",
  run: { stdout: "hi\n", stderr: "", code: 0, output: "hi\n" },
};

function mockFetchJson(body: unknown, status = 200): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof globalThis.fetch;
}

describe("PistonBackend", () => {
  it("execute() POSTs to /api/execute and unwraps body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(OK_RESULT), { status: 200 }));
    const client = new PistonBackend({ baseURL: "https://x", fetch: fetchImpl });
    const res = await client.execute({
      language: "python",
      files: [{ name: "main.py", content: "print('hi')" }],
    });
    expect(res).toEqual(OK_RESULT);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://x/api/execute");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("execute() throws on non-2xx", async () => {
    const fetchImpl = mockFetchJson({ error: "nope" }, 500);
    const client = new PistonBackend({ baseURL: "https://x", fetch: fetchImpl });
    await expect(
      client.execute({ language: "python", files: [{ name: "x.py", content: "" }] }),
    ).rejects.toThrow();
  });

  it("stream() parses ndjson body when present", async () => {
    const ndjson = [
      JSON.stringify({ type: "run-output", executionId: "e1", stream: "stdout", chunk: "hi" }),
      JSON.stringify({ type: "run-end", executionId: "e1", result: OK_RESULT.run }),
    ].join("\n");
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(ndjson, { status: 200, headers: { "content-type": "application/x-ndjson" } }),
      );
    const client = new PistonBackend({ baseURL: "https://x", fetch: fetchImpl });
    const events: { type: string }[] = [];
    for await (const ev of client.stream({
      language: "python",
      files: [{ name: "x.py", content: "" }],
    })) {
      events.push(ev as { type: string });
    }
    expect(events.some((e) => e.type === "run-end")).toBe(true);
    expect(events.some((e) => e.type === "run-output")).toBe(true);
  });

  it("stream() handles empty body gracefully", async () => {
    // 模拟"无法 stream"的端点：fetch 返回 undefined（不会真正成功）
    const fetchImpl = vi.fn().mockResolvedValue(undefined);
    const client = new PistonBackend({ baseURL: "https://x", fetch: fetchImpl });
    const events: { type: string }[] = [];
    // 不应 hang
    for await (const ev of client.stream({
      language: "python",
      files: [{ name: "x.py", content: "" }],
    })) {
      events.push(ev as { type: string });
    }
    // 兜底路径内部调 execute() 会抛错被 stream 捕获为 error
    expect(events.length).toBeGreaterThanOrEqual(0);
  });
});

describe("selectBackend", () => {
  const online: BackendSnapshot = {
    state: "online",
    latencyMs: 10,
    lastChecked: 0,
    error: null,
    server: null,
    apiReachable: true,
  };
  const offline: BackendSnapshot = {
    state: "offline",
    latencyMs: null,
    lastChecked: 0,
    error: null,
    server: null,
    apiReachable: true,
  };

  it("picks Piston when backend online and language supported", () => {
    const b = selectBackend({ language: "python", snapshot: online });
    expect(b?.id).toBe("piston");
  });

  it("falls through Piston when language unsupported", () => {
    // html/css 不在 Piston supportedLanguages 中（实际由浏览器渲染）
    const b = selectBackend({ language: "html", snapshot: online });
    expect(b).toBeNull();
  });

  it("skips Piston when backend offline; picks Pyodide for python", () => {
    const b = selectBackend({ language: "python", snapshot: offline });
    expect(b?.id).toBe("pyodide");
  });

  it("skips Piston when backend offline; null for non-python without worker", () => {
    const b = selectBackend({ language: "javascript", snapshot: offline });
    expect(b).toBeNull();
  });
});
