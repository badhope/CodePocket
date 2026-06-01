export interface PistonStage {
  stdout: string;
  stderr: string;
  output: string;
  code: number;
  signal: string | null;
}

export interface PistonResult {
  language: string;
  version: string;
  run: PistonStage;
  compile?: PistonStage;
  compile_output?: PistonStage;
  cached?: boolean;
}

export interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
  runtime?: string;
}

export interface ExecuteRequest {
  language: string;
  version: string;
  files: { name?: string; content: string; encoding?: string }[];
  stdin?: string;
  args?: string[];
  compile_timeout?: number;
  run_timeout?: number;
  compile_memory_limit?: number;
  run_memory_limit?: number;
  env?: string[];
}

export interface ExecuteLimits {
  cpuTimeMs: number;
  wallTimeMs: number;
  memoryMB: number;
  diskMB: number;
  networkKB: number;
  processes: number;
}

export interface ExecuteResponse {
  success: boolean;
  result?: PistonResult;
  error?: string;
  message?: string;
}

export type ExecuteEvent =
  | { type: "start"; sessionId: string; language: string }
  | { type: "compile"; stage: PistonStage }
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; code: number; durationMs: number; memoryKB?: number }
  | { type: "error"; message: string };

export const DEFAULT_LIMITS: ExecuteLimits = {
  cpuTimeMs: 10_000,
  wallTimeMs: 30_000,
  memoryMB: 256,
  diskMB: 100,
  networkKB: 0,
  processes: 32,
};

export const PRO_LIMITS: ExecuteLimits = {
  cpuTimeMs: 30_000,
  wallTimeMs: 60_000,
  memoryMB: 1024,
  diskMB: 500,
  networkKB: 100,
  processes: 64,
};
