import { z } from "zod";
export declare const RoleSchema: z.ZodEnum<["distributor", "supplier", "admin", "super_admin"]>;
export type Role = z.infer<typeof RoleSchema>;
export declare const PASSWORD_MIN_LENGTH = 12;
export declare const LoginBody: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
}, {
    username: string;
    password: string;
}>;
export type LoginBody = z.infer<typeof LoginBody>;
export declare const RegisterBody: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodString;
    role: z.ZodEnum<["distributor", "supplier"]>;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
    fullName: string;
    phone: string;
    role: "distributor" | "supplier";
}, {
    username: string;
    password: string;
    fullName: string;
    phone: string;
    role: "distributor" | "supplier";
}>;
export type RegisterBody = z.infer<typeof RegisterBody>;
export declare const PasswordRequestBody: z.ZodObject<{
    username: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    username: string;
    note?: string | undefined;
}, {
    username: string;
    note?: string | undefined;
}>;
export type PasswordRequestBody = z.infer<typeof PasswordRequestBody>;
export declare const PublicUser: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    whatsappOptInAt: z.ZodNullable<z.ZodString>;
    role: z.ZodEnum<["distributor", "supplier", "admin", "super_admin"]>;
}, "strip", z.ZodTypeAny, {
    username: string;
    fullName: string;
    phone: string | null;
    role: "distributor" | "supplier" | "admin" | "super_admin";
    id: string;
    whatsappOptInAt: string | null;
}, {
    username: string;
    fullName: string;
    phone: string | null;
    role: "distributor" | "supplier" | "admin" | "super_admin";
    id: string;
    whatsappOptInAt: string | null;
}>;
export type PublicUser = z.infer<typeof PublicUser>;
export declare const WhatsAppConsentBody: z.ZodObject<{
    enabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
}, {
    enabled: boolean;
}>;
