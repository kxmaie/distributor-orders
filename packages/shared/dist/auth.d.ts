import { z } from "zod";
export declare const RoleSchema: z.ZodEnum<["distributor", "admin", "super_admin"]>;
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
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
    fullName: string;
    phone: string;
}, {
    username: string;
    password: string;
    fullName: string;
    phone: string;
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
    role: z.ZodEnum<["distributor", "admin", "super_admin"]>;
}, "strip", z.ZodTypeAny, {
    username: string;
    fullName: string;
    id: string;
    role: "distributor" | "admin" | "super_admin";
}, {
    username: string;
    fullName: string;
    id: string;
    role: "distributor" | "admin" | "super_admin";
}>;
export type PublicUser = z.infer<typeof PublicUser>;
