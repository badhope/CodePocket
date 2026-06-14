/**
 * 后端选择器 — 按优先级选最合适的 ExecutionBackend。
 *
 * 优先级（默认）：
 *   1. 显式传入的 backends 列表
 *   2. Piston（若后端 online）
 *   3. Pyodide（若语言 === "python"）
 *   4. Worker（兜底：JS / TS / Lua / SQL）
 *
 * 选择算法：
 *   - 语言 + 后端 supportedLanguages 取交集
 *   - 第一个能 cover 目标语言的后端胜出
 */

import type { ExecutionBackend } from "./protocol.js";
import { isBackendAvailable, type BackendSnapshot } from "../system/backend-status.js";
import { PistonBackend, type PistonBackendOptions } from "./backends/piston.js";
import { PyodideBackend, type PyodideBackendOptions } from "./backends/pyodide.js";
import { WorkerBackend, type WorkerBackendOptions } from "./backends/worker.js";

export interface SelectBackendOptions {
  /** 任意语言 id（string 而非 Language 联合，避免 listLanguages 未来扩展时炸类型） */
  language: string;
  snapshot?: BackendSnapshot | null;
  piston?: PistonBackend | PistonBackendOptions;
  pyodide?: PyodideBackend | PyodideBackendOptions;
  worker?: WorkerBackend | WorkerBackendOptions;
}

function supports(b: ExecutionBackend, lang: string): boolean {
  // b.supportedLanguages 是 readonly 联合元组，includes 需要 cast
  return (b.supportedLanguages as readonly string[]).includes(lang);
}

function asPiston(p: PistonBackend | PistonBackendOptions | undefined): PistonBackend | null {
  if (!p) return new PistonBackend();
  return p instanceof PistonBackend ? p : new PistonBackend(p);
}
function asPyodide(p: PyodideBackend | PyodideBackendOptions | undefined): PyodideBackend | null {
  if (!p) return new PyodideBackend();
  return p instanceof PyodideBackend ? p : new PyodideBackend(p);
}
function asWorker(p: WorkerBackend | WorkerBackendOptions | undefined): WorkerBackend | null {
  if (!p) return null; // worker 必须传实例（含 workerUrl），无默认
  return p instanceof WorkerBackend ? p : null;
}

/** 选最优后端；返回 null 表示当前环境无法执行 */
export function selectBackend(opts: SelectBackendOptions): ExecutionBackend | null {
  const candidates: ExecutionBackend[] = [];

  // 1) 显式 Piston
  if (opts.snapshot && isBackendAvailable(opts.snapshot)) {
    const piston = asPiston(opts.piston ?? {});
    if (piston && supports(piston, opts.language)) {
      return piston;
    }
  } else if (opts.piston) {
    // 即使后端暂未上线，调用方显式要 Piston 时仍可用
    const piston = asPiston(opts.piston);
    if (piston && supports(piston, opts.language)) {
      candidates.push(piston);
    }
  }

  // 2) Pyodide（仅 python）
  if (opts.language === "python") {
    const py = asPyodide(opts.pyodide);
    if (py) candidates.push(py);
  }

  // 3) Worker 兜底（必须显式传 workerUrl 才能用）
  const w = asWorker(opts.worker);
  if (w && supports(w, opts.language)) {
    candidates.push(w);
  }

  return candidates[0] ?? null;
}
