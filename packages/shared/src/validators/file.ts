import { z } from "zod";

export const fileSchema = z.object({
  id: z.string().min(1).max(64),
  projectId: z.string().min(1).max(64),
  name: z.string().min(1).max(256),
  /** 文件内容（base64 编码时） */
  contentBase64: z.string().max(10_000_000).optional(),
  /** 文件内容（明文） */
  content: z.string().max(1_000_000).optional(),
  /** mime type */
  mime: z.string().min(1).max(256).optional(),
  /** 字节大小 */
  size: z.number().int().min(0).max(50_000_000),
});
export type FileInput = z.infer<typeof fileSchema>;

export const filePatchSchema = fileSchema.partial().pick({
  name: true,
  content: true,
  contentBase64: true,
  mime: true,
});
export type FilePatch = z.infer<typeof filePatchSchema>;
