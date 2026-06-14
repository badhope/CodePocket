/**
 * Web Worker 沙盒：跑 JS / TS / Lua / SQL。
 * 仅 H5 / App 可用（小程序 Worker API 不同），Node SSR 不可用。
 *
 * 设计：
 *   - 父线程：构造 Worker，把代码 + 输入 postMessage 进去
 *   - 子线程（worker.js）：执行并通过 postMessage 回 stdout / stderr / done
 *   - 内存 + CPU 限制由父线程看门狗（心跳超时）实现
 *
 * 注意：实际 Worker 脚本以字符串内联，Vite/uni-app 在构建期打包成独立 chunk。
 * 这里我们导出的是接口 + 包装器；Worker 脚本另存在 sandbox/worker.js。
 */

import type { ExecutionBackend, ExecutionRequest, ExecutionResult, ExecutionEvent } from "../protocol.js";
import { inferLanguageFromFilename } from "../languages.js";
import { AbortError, throwIfAborted } from "../abort.js";

export interface WorkerBackendOptions {
  /** Worker 脚本 URL（apps/h5/src/sandbox/worker.js） */
  workerUrl: string | URL;
  /** 沙盒超时（默认 10s） */
  timeoutMs?: number;
}

interface WorkerOk {
  type: "ok";
  result: ExecutionResult;
}
interface WorkerErr {
  type: "err";
  error: string;
}
interface WorkerChunk {
  type: "chunk";
  stream: "stdout" | "stderr";
  data: string;
}
type WorkerMsg = WorkerOk | WorkerErr | WorkerChunk;

/** 简单 Worker 沙盒：JS / TS / Lua / SQL */
export class WorkerBackend implements ExecutionBackend {
  readonly id = "worker";
  readonly networkRequired = false;
  readonly supportedLanguages: readonly string[] = ["javascript", "typescript", "lua", "sql"];

  private readonly workerUrl: string | URL;
  private readonly timeoutMs: number;

  constructor(opts: WorkerBackendOptions) {
    this.workerUrl = opts.workerUrl;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  /**
   * 同步执行（一次性返回 result）。实际内部用 postMessage + Promise 包装。
   * signal 触发：抛 AbortError。
   */
  async execute(req: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult> {
    throwIfAborted(signal);
    const out: ExecutionStageLike = { stdout: "", stderr: "", code: null };
    for await (const ev of this.stream(req, signal)) {
      if (ev.type === "run-output") {
        if (ev.stream === "stdout") out.stdout += ev.chunk;
        else out.stderr += ev.chunk;
      } else if (ev.type === "run-end") {
        out.code = ev.result.code;
        out.signal = ev.result.signal ?? null;
        // 合并（stream 模式下已聚合；此为兜底）
        if (!out.stdout) out.stdout = ev.result.stdout;
        if (!out.stderr) out.stderr = ev.result.stderr;
        return {
          language: req.language,
          version: "worker",
          run: {
            stdout: out.stdout,
            stderr: out.stderr,
            code: out.code,
            signal: out.signal,
            output: out.stdout + out.stderr,
          },
        };
      } else if (ev.type === "error") {
        if (ev.code === "aborted") {
          throw new AbortError(ev.message);
        }
        throw new Error(ev.message);
      }
    }
    // 兜底：未拿到 run-end
    return {
      language: req.language,
      version: "worker",
      run: {
        stdout: out.stdout,
        stderr: out.stderr || "[worker] run-end never received",
        code: out.code,
        signal: out.signal,
        output: out.stdout + out.stderr,
      },
    };
  }

  /**
   * 流式：父线程监听 worker message 转换为 ExecutionEvent。
   */
  async *stream(req: ExecutionRequest, signal?: AbortSignal): AsyncIterable<ExecutionEvent> {
    const execId = `wrk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    yield { type: "started", executionId: execId, language: req.language, version: "worker" };

    const worker = new Worker(this.workerUrl, { type: "module" });
    const chunks: { stream: "stdout" | "stderr"; data: string }[] = [];
    let resolved: ((v: WorkerOk) => void) | null = null;
    let rejected: ((e: Error) => void) | null = null;
    const done = new Promise<WorkerOk>((res, rej) => {
      resolved = res;
      rejected = rej;
    });

    const onMsg = (e: MessageEvent<WorkerMsg>) => {
      const m = e.data;
      if (m.type === "chunk") chunks.push({ stream: m.stream, data: m.data });
      else if (m.type === "ok") resolved?.(m);
      else if (m.type === "err") rejected?.(new Error(m.error));
    };
    const onErr = (e: ErrorEvent) => rejected?.(new Error(e.message || "worker error"));
    worker.addEventListener("message", onMsg);
    worker.addEventListener("error", onErr);

    const timer = setTimeout(() => {
      rejected?.(new Error(`worker timed out after ${this.timeoutMs}ms`));
    }, this.timeoutMs);

    const onAbort = () => {
      rejected?.(new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort);

    const lang = req.language || inferLanguageFromFilename(req.files[0]?.name ?? "");
    worker.postMessage({
      type: "run",
      language: lang,
      files: req.files,
      stdin: req.stdin ?? "",
    });

    try {
      const ok = await done;
      for (const c of chunks) {
        yield { type: "run-output", executionId: execId, stream: c.stream, chunk: c.data };
      }
      yield { type: "run-end", executionId: execId, result: ok.result.run };
    } catch (e) {
      yield {
        type: "error",
        executionId: execId,
        message: (e as Error).message,
        code: "worker_error",
      };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      worker.removeEventListener("message", onMsg);
      worker.removeEventListener("error", onErr);
      worker.terminate();
    }
  }
}

interface ExecutionStageLike {
  stdout: string;
  stderr: string;
  code: number | null;
  signal?: string | null;
}
