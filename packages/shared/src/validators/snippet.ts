import { z } from "zod";
import { SUPPORTED_LANGUAGES } from "../execution/languages.js";

export const snippetSchema = z.object({
  id: z.string().min(1).max(64),
  shortId: z
    .string()
    .min(4)
    .max(16)
    .regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().min(1).max(200),
  language: z.enum(SUPPORTED_LANGUAGES),
  content: z.string().max(1_000_000),
  authorId: z.string().nullable(),
  isPublic: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Snippet = z.infer<typeof snippetSchema>;

export const createSnippetSchema = z.object({
  title: z.string().min(1).max(200),
  language: z.enum(SUPPORTED_LANGUAGES),
  content: z.string().max(1_000_000),
  isPublic: z.boolean().default(false),
});
export type CreateSnippetInput = z.infer<typeof createSnippetSchema>;
