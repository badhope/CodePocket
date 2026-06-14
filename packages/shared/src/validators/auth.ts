import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(256),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = signInSchema
  .extend({
    name: z.string().min(1).max(64).optional(),
    confirmPassword: z.string().min(8).max(256),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(256),
  newPassword: z.string().min(8).max(256),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
