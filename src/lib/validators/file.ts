import { z } from "zod";

export const filePathSchema = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^\/?([^/\\]+\/)*[^/\\]+$/, "Invalid file path");

export const createFileSchema = z.object({
  projectId: z.string().uuid(),
  path: filePathSchema,
  type: z.enum(["file", "directory"]).default("file"),
  content: z.string().max(5 * 1024 * 1024).optional(),
  mime: z.string().max(128).optional(),
  encoding: z.enum(["utf-8", "base64", "binary"]).default("utf-8"),
});

export const updateFileSchema = z.object({
  content: z.string().max(5 * 1024 * 1024).optional(),
  commitMessage: z.string().max(500).optional(),
});

export const moveFileSchema = z.object({
  newPath: filePathSchema,
});

export const bulkDeleteSchema = z.object({
  paths: z.array(filePathSchema).min(1).max(1000),
});

export type CreateFileInput = z.infer<typeof createFileSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
export type MoveFileInput = z.infer<typeof moveFileSchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
