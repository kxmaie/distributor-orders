import { z } from "zod";

export const RoleSchema = z.enum(["distributor", "admin", "super_admin"]);
export type Role = z.infer<typeof RoleSchema>;

export const PASSWORD_MIN_LENGTH = 12;

export const LoginBody = z.object({
  username: z.string().trim().min(3).max(60),
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof LoginBody>;

export const RegisterBody = z.object({
  username: z.string().trim().min(3).max(60),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(200),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(5).max(20),
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const PasswordRequestBody = z.object({
  username: z.string().trim().min(3).max(60),
  note: z.string().trim().max(255).optional(),
});
export type PasswordRequestBody = z.infer<typeof PasswordRequestBody>;

export const PublicUser = z.object({
  id: z.string(),
  username: z.string(),
  fullName: z.string(),
  phone: z.string().nullable(),
  whatsappOptInAt: z.string().nullable(),
  role: RoleSchema,
});
export type PublicUser = z.infer<typeof PublicUser>;

export const WhatsAppConsentBody = z.object({ enabled: z.boolean() });
