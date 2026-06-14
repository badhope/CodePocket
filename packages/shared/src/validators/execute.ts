import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../execution/languages.js";

export const executeRequestSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  version: z.string().min(1).max(32).optional(),
  /** 用户代码 */
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(128),
        content: z.string().max(1_000_000),
      }),
    )
    .min(1)
    .max(8),
  /** 共享标准输入 */
  stdin: z.string().max(10_000).optional(),
  /** 编译参数 */
  compileArgs: z.array(z.string().max(256)).max(32).optional(),
  /** 运行参数 */
  runArgs: z.array(z.string().max(256)).max(32).optional(),
  /** 资源限制 */
  limits: z
    .object({
      cpuTimeMs: z.number().int().min(100).max(60_000).optional(),
      wallTimeMs: z.number().int().min(100).max(120_000).optional(),
      memoryMb: z.number().int().min(16).max(2048).optional(),
    })
    .optional(),
});
export type ExecuteRequest = z.infer<typeof executeRequestSchema>;

export const executeResultSchema = z.object({
  language: z.string(),
  version: z.string(),
  run: z.object({
    stdout: z.string(),
    stderr: z.string(),
    code: z.number().int().nullable(),
    signal: z.string().nullable().optional(),
    output: z.string().optional(),
  }),
  compile: z
    .object({
      stdout: z.string(),
      stderr: z.string(),
      code: z.number().int().nullable(),
      output: z.string().optional(),
    })
    .optional(),
});
export type ExecuteResult = z.infer<typeof executeResultSchema>;
