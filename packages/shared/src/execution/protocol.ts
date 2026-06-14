/**
 * 代码执行协议 — 框架无关的请求 / 响应 / 事件类型。
 * 后端 Piston 适配、前端 Pyodide / Web Worker 适配都遵守同一份协议。
 */

/** 用户提交的执行请求 */
export interface ExecutionRequest {
  language: string;
  version?: string;
  files: ExecutionFile[];
  stdin?: string;
  runArgs?: string[];
  compileArgs?: string[];
  /** 环境变量（受 allowlist 限制） */
  env?: Record<string, string>;
  /** 资源限制 */
  limits?: ExecutionLimits;
}

export interface ExecutionFile {
  name: string;
  /** UTF-8 文本内容 */
  content: string;
  /** base64 二进制（如图片） */
  contentBase64?: string;
}

export interface ExecutionLimits {
  cpuTimeMs?: number;
  wallTimeMs?: number;
  memoryMb?: number;
  maxProcesses?: number;
}

/** 单次执行的完整结果 */
export interface ExecutionResult {
  language: string;
  version: string;
  run: ExecutionStageResult;
  compile?: ExecutionStageResult;
}

export interface ExecutionStageResult {
  stdout: string;
  stderr: string;
  /** 进程退出码；null 表示被信号杀掉 */
  code: number | null;
  signal?: string | null;
  /** 合并 stdout + stderr 便于显示 */
  output: string;
}

/** 流式事件 */
export type ExecutionEvent =
  | { type: "started"; executionId: string; language: string; version: string }
  | { type: "compile-start"; executionId: string }
  | { type: "compile-output"; executionId: string; stream: "stdout" | "stderr"; chunk: string }
  | { type: "compile-end"; executionId: string; result: ExecutionStageResult }
  | { type: "run-start"; executionId: string }
  | { type: "run-output"; executionId: string; stream: "stdout" | "stderr"; chunk: string }
  | { type: "run-end"; executionId: string; result: ExecutionStageResult }
  | { type: "error"; executionId: string; message: string; code?: string };

/** 抽象执行器接口 */
export interface ExecutionBackend {
  readonly id: string;
  /** 这个后端支持哪些语言（id 列表） */
  readonly supportedLanguages: readonly string[];
  /** 是否需要联网 */
  readonly networkRequired: boolean;
  /** 同步执行（一次性返回结果） */
  execute(req: ExecutionRequest, signal?: AbortSignal): Promise<ExecutionResult>;
  /** 流式执行（订阅事件） */
  stream(req: ExecutionRequest, signal?: AbortSignal): AsyncIterable<ExecutionEvent>;
}
