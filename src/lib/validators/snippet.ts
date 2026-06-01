import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "@/lib/constants";

export const createSnippetSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  language: z.enum(SUPPORTED_LANGUAGES),
  code: z.string().min(1).max(5 * 1024 * 1024),
  tags: z.array(z.string().min(1).max(32)).max(20).default([]),
  visibility: z.enum(["private", "public", "unlisted"]).default("private"),
});

export const updateSnippetSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  code: z.string().min(1).max(5 * 1024 * 1024).optional(),
  tags: z.array(z.string().min(1).max(32)).max(20).optional(),
  visibility: z.enum(["private", "public", "unlisted"]).optional(),
});

export const snippetIdSchema = z.object({
  id: z.string().uuid(),
});

export type CreateSnippetInput = z.infer<typeof createSnippetSchema>;
export type UpdateSnippetInput = z.infer<typeof updateSnippetSchema>;
