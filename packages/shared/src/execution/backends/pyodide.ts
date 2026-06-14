/**
 * Pyodide 客户端沙盒 — Python 在浏览器中跑。
 * 懒加载：首次调用时下载 ~10MB 的 pyodide 资源，缓存到 IndexedDB / 内存。
 *
 * 仅 H5 / App 可用。小程序无 WebAssembly，跑不了。
 */

import type {
  ExecutionBackend,
  ExecutionRequest,
  ExecutionResult,
  ExecutionEvent,
} from "../protocol.js";
import { AbortError, throwIfAborted } from "../abort.js";

export interface PyodideBackendOptions {
  /** pyodide.js CDN 地址，默认 jsDelivr */
  cdnUrl?: string;
  /** 索引 URL（wasm + 标准库） */
  indexUrl?: string;
  /** 全局名，默认 loadPyodide */
  globalName?: string;
  /** 沙盒超时 */
  timeoutMs?: number;
}

declare global {
  interface Window {
    [key: string]: unknown;
  }
}

/** Pyodide 沙盒：仅 Python */
export class PyodideBackend implements ExecutionBackend {
  readonly id = "pyodide";
  readonly networkRequired = true; // 首次需下载
  readonly supportedLanguages: readonly string[] = ["python"];

  private readonly cdnUrl: string;
  private readonly indexUrl: string;
  private readonly globalName: string;
  private readonly timeoutMs: number;
  private loadPromise: Promise<unknown> | null = null;

  constructor(opts: PyodideBackendOptions = {}) {
    this.cdnUrl = opts.cdnUrl ?? "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/";
    this.indexUrl = opts.indexUrl ?? this.cdnUrl;
    this.globalName = opts.globalName ?? "loadPyodide";
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  private async loadPyodide(): Promise<unknown> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      if (typeof globalThis === "undefined") {
        throw new Error("Pyodide requires browser/Worker environment");
      }
      const w = globalThis as unknown as Record<string, unknown>;
      if (typeof w[this.globalName] === "function") {
        return w[this.globalName] as (opts: { indexURL: string }) => Promise<PyodideLike>;
      }
      // 动态 import CDN 脚本
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `${this.cdnUrl}pyodide.js`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`failed to load pyodide.js from ${this.cdnUrl}`));
        document.head.appendChild(s);
      });
      return w[this.globalName];
    })();
    return this.loadPromise;
  }

  async execute(req: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult> {
    for await (const ev of this.stream(req, signal)) {
      if (ev.type === "run-end") {
        return {
          language: "python",
          version: "pyodide",
          run: ev.result,
        };
      }
      if (ev.type === "error") {
        if (ev.code === "aborted") throw new AbortError(ev.message);
        throw new Error(ev.message);
      }
    }
    throw new Error("pyodide run did not emit run-end");
  }

  async *stream(req: ExecutionRequest, signal?: AbortSignal): AsyncIterable<ExecutionEvent> {
    throwIfAborted(signal);
    const execId = `py-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    yield { type: "started", executionId: execId, language: "python", version: "pyodide" };

    const loadFactory = (await this.loadPyodide()) as (opts: {
      indexURL: string;
    }) => Promise<PyodideLike>;
    throwIfAborted(signal);
    const py = await loadFactory({ indexURL: this.indexUrl });
    throwIfAborted(signal);
    const file = req.files[0];
    if (!file) {
      yield { type: "error", executionId: execId, message: "no files provided" };
      return;
    }

    let stdout = "";
    let stderr = "";
    py.setStdout({
      batched: (s: string) => {
        stdout += s + "\n";
      },
    });
    py.setStderr({
      batched: (s: string) => {
        stderr += s + "\n";
      },
    });

    let code: number | null = 0;
    let aborted = false;
    const onAbort = () => {
      aborted = true;
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      await py.runPythonAsync(file.content);
    } catch (e) {
      stderr += (e as Error).message + "\n";
      code = 1;
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
    if (aborted || signal?.aborted) {
      yield { type: "error", executionId: execId, message: "aborted", code: "aborted" };
      return;
    }
    if (stdout) {
      yield { type: "run-output", executionId: execId, stream: "stdout", chunk: stdout };
    }
    if (stderr) {
      yield { type: "run-output", executionId: execId, stream: "stderr", chunk: stderr };
    }
    yield {
      type: "run-end",
      executionId: execId,
      result: { stdout, stderr, code, signal: null, output: stdout + stderr },
    };
  }
}

interface PyodideLike {
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
  runPythonAsync(code: string): Promise<void>;
}
