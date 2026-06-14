/**
 * 校验器模块 — 导出 zod schemas 供 json-schema-validator 使用
 */
import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  language: z.string().min(1, "Language is required"),
});

export { z };
