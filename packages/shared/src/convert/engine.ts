/**
 * 文档转换调度器。
 * - 本地能做的对：直接调 converters.ts
 * - DOCX / XLSX：交给 backend /api/convert（h5 注入 ApiClient）
 *
 * 提供进度回调（onProgress 0..1）让 UI 能显示进度条。
 * 支持 AbortSignal：用户点取消时终止转换（PDF 渲染中是周期性检查）。
 */

import {
  CONVERSION_PAIRS,
  findPair,
  FORMAT_MIME,
  type ConversionPair,
  type DocumentFormat,
} from "./formats.js";
import {
  mdToHtml,
  htmlToMd,
  mdToTxt,
  txtToMd,
  htmlToJson,
  jsonToHtml,
  jsonToXml,
  xmlToJson,
  htmlToPdf,
} from "./converters.js";
import { AbortError, throwIfAborted } from "../execution/abort.js";

/** 转换结果：成功时 output 是文本（PDF 时是 Uint8Array） */
export type ConvertResult =
  | { ok: true; output: string | Uint8Array; mime: string; pair: ConversionPair }
  | { ok: false; error: string; pair?: ConversionPair; aborted?: boolean };

/** 进度回调 */
export type ProgressFn = (stage: string, ratio: number) => void;

/** 后端 fallback（DOCX / XLSX 走这里；由 h5 注入） */
export interface BackendConverter {
  convert(
    from: DocumentFormat,
    to: DocumentFormat,
    input: string | Uint8Array,
    onProgress?: ProgressFn,
    signal?: AbortSignal,
  ): Promise<ConvertResult>;
}

/** convert() 选项 */
export interface ConvertOptions {
  onProgress?: ProgressFn;
  backend?: BackendConverter;
  signal?: AbortSignal;
}

/** 入口：按 (from, to) 调对应实现。
 *  - input 文本：所有纯前端对都要求 string
 *  - input 二进制：仅在走 backend 路径时才有意义 */
export async function convert(
  input: string | Uint8Array,
  from: DocumentFormat,
  to: DocumentFormat,
  options: ConvertOptions = {},
): Promise<ConvertResult> {
  const pair = findPair(from, to);
  if (!pair) {
    return { ok: false, error: `unsupported conversion: ${from} → ${to}` };
  }
  const onProgress = options.onProgress ?? (() => {});
  const signal = options.signal;
  onProgress("starting", 0);

  try {
    throwIfAborted(signal);

    if (!pair.local) {
      if (!options.backend) {
        return {
          ok: false,
          pair,
          error: `${from} → ${to} requires backend (no client provided)`,
        };
      }
      onProgress("uploading", 0.1);
      const res = await options.backend.convert(from, to, input, onProgress, signal);
      onProgress("done", 1);
      return res;
    }

    onProgress("converting", 0.3);
    throwIfAborted(signal);
    // 本地路径仅处理 string 输入；二进制的本地对目前不存在。
    if (typeof input !== "string") {
      return { ok: false, pair, error: `local converter for ${from} → ${to} expects text input` };
    }
    let output: string | Uint8Array;
    if (pair.hint === "marked") output = mdToHtml(input);
    else if (pair.hint === "turndown") output = htmlToMd(input);
    else if (pair.hint === "strip") output = mdToTxt(input);
    else if (pair.hint === "wrap") output = txtToMd(input);
    else if (pair.hint === "html-walk") output = htmlToJson(input);
    else if (pair.hint === "escape") output = jsonToHtml(input);
    else if (pair.hint === "fast-xml-parser") {
      output = pair.from === "json" ? jsonToXml(input) : xmlToJson(input);
    } else if (pair.hint === "pdf-lib") {
      // PDF 生成是大块操作；周期性检查 signal
      if (signal) {
        const periodic = setInterval(() => {
          if (signal.aborted) clearInterval(periodic);
        }, 100);
        try {
          output = await htmlToPdf(input);
        } finally {
          clearInterval(periodic);
        }
        throwIfAborted(signal);
      } else {
        output = await htmlToPdf(input);
      }
    } else {
      return { ok: false, pair, error: `no handler for hint: ${pair.hint}` };
    }
    onProgress("done", 1);
    return { ok: true, output, mime: FORMAT_MIME[to], pair };
  } catch (e) {
    if (e instanceof AbortError || signal?.aborted) {
      return { ok: false, pair, aborted: true, error: "aborted" };
    }
    return { ok: false, pair, error: (e as Error).message ?? "convert failed" };
  }
}

/** 列出所有支持的对（用于 UI） */
export function listSupportedPairs(): readonly ConversionPair[] {
  return CONVERSION_PAIRS;
}
