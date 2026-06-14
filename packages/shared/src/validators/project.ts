import { z } from "zod";

export const projectSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["private", "unlisted", "public"]).default("private"),
  tags: z.array(z.string().min(1).max(32)).max(32).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export const createProjectSchema = projectSchema
  .pick({ name: true, description: true, visibility: true, tags: true })
  .required({ name: true });
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
