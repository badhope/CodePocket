/**
 * Piston 后端适配 — 通过 Next.js /api/execute 调用 Piston-shim。
 * 真实后端跑 Piston 容器，跨语言支持 19 种。
 *
 * API 约定：
 *   POST /api/execute        { language, version?, files, stdin?, limits? } → ExecutionResult
 *   POST /api/execute/stream 同样的 payload → SSE/ndjson 流式 ExecutionEvent
 */

import type {
  ExecutionBackend,
  ExecutionRequest,
  ExecutionResult,
  ExecutionEvent,
} from "../protocol.js";
import { ApiClient, ENDPOINTS } from "../../api-client/index.js";
import { throwIfAborted } from "../abort.js";

export interface PistonBackendOptions {
  baseURL?: string;
  /** fetch 实现；默认 globalThis.fetch */
  fetch?: typeof globalThis.fetch;
  /** 单次请求超时（默认 60s） */
  timeoutMs?: number;
  /** 自定义 header（如 Piston API key） */
  headers?: Record<string, string>;
}

export class PistonBackend implements ExecutionBackend {
  readonly id = "piston";
  readonly networkRequired = true;
  readonly supportedLanguages: readonly string[] = [
    "python",
    "javascript",
    "typescript",
    "cpp",
    "c",
    "java",
    "rust",
    "go",
    "csharp",
    "php",
    "ruby",
    "kotlin",
    "swift",
    "scala",
    "bash",
    "lua",
    "sql",
  ] as const;

  private readonly client: ApiClient;
  private readonly timeoutMs: number;

  constructor(opts: PistonBackendOptions = {}) {
    this.client = new ApiClient({
      baseURL: opts.baseURL ?? "",
      fetch: opts.fetch,
      headers: opts.headers,
    });
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  async execute(req: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult> {
    return this.client.post<ExecutionResult>(ENDPOINTS.execute, req, {
      signal,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * 流式执行：fetch ReadableStream → ndjson 逐行解析 → ExecutionEvent。
   * 若后端未启用 stream，回退到单次 execute。
   * signal 触发：reader.read 抛 AbortError，转换为 error 事件后退出。
   */
  async *stream(req: ExecutionRequest, signal?: AbortSignal): AsyncIterable<ExecutionEvent> {
    throwIfAborted(signal);
    let res: Response | undefined;
    try {
      res = (await this.client.request<Response>(ENDPOINTS.executeStream, {
        method: "POST",
        body: req,
        signal,
        timeoutMs: this.timeoutMs,
        raw: true,
      })) as Response;
    } catch (e) {
      const name = (e as Error).name;
      if (name === "AbortError" || signal?.aborted) {
        yield {
          type: "error",
          executionId: "n/a",
          message: "aborted by caller",
          code: "aborted",
        };
        return;
      }
      // 网络错误：回退到单次执行
      try {
        const result = await this.execute(req, signal);
        yield { type: "run-end", executionId: "n/a", result: result.run };
      } catch (e2) {
        yield {
          type: "error",
          executionId: "n/a",
          message: (e2 as Error).message,
          code: "piston_fallback_failed",
        };
      }
      return;
    }
    if (!res || !res.body) {
      // 回退：单次执行并合成事件
      try {
        const result = await this.execute(req, signal);
        yield { type: "run-end", executionId: "n/a", result: result.run };
      } catch (e) {
        yield {
          type: "error",
          executionId: "n/a",
          message: (e as Error).message,
          code: "piston_fallback_failed",
        };
      }
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    try {
      for (;;) {
        throwIfAborted(signal);
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          try {
            yield JSON.parse(line) as ExecutionEvent;
          } catch {
            /* 跳过非 JSON 行 */
          }
        }
      }
      if (buf.trim()) {
        try {
          yield JSON.parse(buf) as ExecutionEvent;
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      const name = (e as Error).name;
      if (name === "AbortError" || signal?.aborted) {
        yield {
          type: "error",
          executionId: "n/a",
          message: "aborted by caller",
          code: "aborted",
        };
        return;
      }
      yield {
        type: "error",
        executionId: "n/a",
        message: (e as Error).message,
        code: "stream_failed",
      };
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }
  }
}
