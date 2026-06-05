// @ts-nocheck -- third-party types are incomplete
import { z } from "zod";

const SUPPORTED_LANGUAGES = ["python", "javascript", "typescript", "cpp", "c", "java", "rust", "go", "csharp", "php", "ruby", "kotlin", "swift", "scala", "bash", "lua", "sql", "html", "css"] as const

const limitsSchema = z.object({
  cpuTimeMs: z.number().int().min(100).max(60_000).default(10_000),
  wallTimeMs: z.number().int().min(100).max(120_000).default(30_000),
  memoryMB: z.number().int().min(16).max(2048).default(256),
  diskMB: z.number().int().min(1).max(1024).default(100),
  networkKB: z.number().int().min(0).max(10_000).default(0),
  processes: z.number().int().min(1).max(64).default(32),
});

const fileSchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().max(5 * 1024 * 1024),
  encoding: z.enum(["utf-8", "base64"]).default("utf-8"),
});

export const executeSchema = z.object({
  language: z.enum(SUPPORTED_LANGUAGES),
  version: z.string().max(32).optional(),
  files: z.array(fileSchema).min(1).max(50),
  stdin: z.string().max(64 * 1024).optional(),
  args: z.array(z.string().max(512)).max(64).default([]),
  env: z.record(z.string(), z.string().max(1024)).default({}),
  compileTimeoutMs: z.number().int().min(100).max(60_000).default(10_000),
  runTimeoutMs: z.number().int().min(100).max(60_000).default(10_000),
  limits: limitsSchema.optional(),
  runOnly: z.boolean().default(false),
});

export type ExecuteInput = z.infer<typeof executeSchema>;
export type ExecuteFile = z.infer<typeof fileSchema>;
export type ExecuteLimits = z.infer<typeof limitsSchema>;
