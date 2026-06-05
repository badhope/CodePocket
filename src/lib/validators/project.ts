// @ts-nocheck -- third-party types are incomplete
import { z } from "zod";

const SUPPORTED_LANGUAGES = ["python", "javascript", "typescript", "cpp", "c", "java", "rust", "go", "csharp", "php", "ruby", "kotlin", "swift", "scala", "bash", "lua", "sql", "html", "css"] as const

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().regex(slugRegex, "Invalid slug").max(255).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["private", "public", "unlisted"]).default("private"),
  language: z.enum(SUPPORTED_LANGUAGES).default("python"),
  template: z.string().max(64).optional(),
  teamId: z.string().uuid().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["private", "public", "unlisted"]).optional(),
  language: z.enum(SUPPORTED_LANGUAGES).optional(),
});

export const projectIdSchema = z.object({
  id: z.string().uuid(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
