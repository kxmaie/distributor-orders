import { z } from "zod";
export declare const Pct: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>, string, string | number>;
export declare const UserListQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    q: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodEnum<["distributor", "supplier", "admin", "super_admin"]>>;
    active: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
    pending: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    role?: "distributor" | "supplier" | "admin" | "super_admin" | undefined;
    active?: "true" | "false" | undefined;
    pending?: "true" | "false" | undefined;
    q?: string | undefined;
}, {
    role?: "distributor" | "supplier" | "admin" | "super_admin" | undefined;
    active?: "true" | "false" | undefined;
    pending?: "true" | "false" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    q?: string | undefined;
}>;
export declare const UserApproveBody: z.ZodObject<{
    defaultDiscountPct: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>, string, string | number>>;
}, "strip", z.ZodTypeAny, {
    defaultDiscountPct?: string | undefined;
}, {
    defaultDiscountPct?: string | number | undefined;
}>;
export type UserApproveBody = z.infer<typeof UserApproveBody>;
export declare const UserCreate: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
    fullName: z.ZodString;
    phone: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNull]>, string | null, string | null>>;
    role: z.ZodDefault<z.ZodEnum<["distributor", "supplier", "admin", "super_admin"]>>;
    defaultDiscountPct: z.ZodDefault<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>, string, string | number>>;
}, "strip", z.ZodTypeAny, {
    username: string;
    password: string;
    fullName: string;
    role: "distributor" | "supplier" | "admin" | "super_admin";
    defaultDiscountPct: string;
    phone?: string | null | undefined;
}, {
    username: string;
    password: string;
    fullName: string;
    phone?: string | null | undefined;
    role?: "distributor" | "supplier" | "admin" | "super_admin" | undefined;
    defaultDiscountPct?: string | number | undefined;
}>;
export declare const UserUpdate: z.ZodObject<{
    fullName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNull]>, string | null, string | null>>;
    role: z.ZodOptional<z.ZodEnum<["distributor", "supplier", "admin", "super_admin"]>>;
    defaultDiscountPct: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>, string, string | number>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    password: z.ZodOptional<z.ZodString>;
    unlock: z.ZodOptional<z.ZodLiteral<true>>;
}, "strip", z.ZodTypeAny, {
    password?: string | undefined;
    fullName?: string | undefined;
    phone?: string | null | undefined;
    role?: "distributor" | "supplier" | "admin" | "super_admin" | undefined;
    isActive?: boolean | undefined;
    defaultDiscountPct?: string | undefined;
    unlock?: true | undefined;
}, {
    password?: string | undefined;
    fullName?: string | undefined;
    phone?: string | null | undefined;
    role?: "distributor" | "supplier" | "admin" | "super_admin" | undefined;
    isActive?: boolean | undefined;
    defaultDiscountPct?: string | number | undefined;
    unlock?: true | undefined;
}>;
export declare const PasswordRequestQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["pending", "resolved", "rejected"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "pending" | "resolved" | "rejected" | undefined;
}, {
    status?: "pending" | "resolved" | "rejected" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const PasswordResolveBody: z.ZodEffects<z.ZodObject<{
    status: z.ZodEnum<["resolved", "rejected"]>;
    newPassword: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "resolved" | "rejected";
    newPassword?: string | undefined;
}, {
    status: "resolved" | "rejected";
    newPassword?: string | undefined;
}>, {
    status: "resolved" | "rejected";
    newPassword?: string | undefined;
}, {
    status: "resolved" | "rejected";
    newPassword?: string | undefined;
}>;
export declare const DiscountListQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    userId: z.ZodOptional<z.ZodEffects<z.ZodString, bigint, string>>;
    active: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    active?: "true" | "false" | undefined;
    userId?: bigint | undefined;
}, {
    active?: "true" | "false" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    userId?: string | undefined;
}>;
export declare const DiscountCreate: z.ZodObject<{
    userId: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodNull]>>, bigint | null, string | number | null | undefined>;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    productId: z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodNull]>>, bigint | null, string | number | null | undefined>;
    pct: z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>, string, string | number>;
    startsAt: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    endsAt: z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    productId: bigint | null;
    userId: bigint | null;
    pct: string;
    categoryId?: number | null | undefined;
    startsAt?: string | null | undefined;
    endsAt?: string | null | undefined;
}, {
    pct: string | number;
    isActive?: boolean | undefined;
    categoryId?: number | null | undefined;
    productId?: string | number | null | undefined;
    userId?: string | number | null | undefined;
    startsAt?: string | null | undefined;
    endsAt?: string | null | undefined;
}>;
export declare const DiscountUpdate: z.ZodObject<{
    userId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodNull]>>, bigint | null, string | number | null | undefined>>;
    categoryId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    productId: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodNull]>>, bigint | null, string | number | null | undefined>>;
    pct: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>, string, string | number>>;
    startsAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>>;
    endsAt: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    isActive?: boolean | undefined;
    categoryId?: number | null | undefined;
    productId?: bigint | null | undefined;
    userId?: bigint | null | undefined;
    pct?: string | undefined;
    startsAt?: string | null | undefined;
    endsAt?: string | null | undefined;
}, {
    isActive?: boolean | undefined;
    categoryId?: number | null | undefined;
    productId?: string | number | null | undefined;
    userId?: string | number | null | undefined;
    pct?: string | number | undefined;
    startsAt?: string | null | undefined;
    endsAt?: string | null | undefined;
}>;
export declare const ReportsQuery: z.ZodObject<{
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    from?: string | undefined;
    to?: string | undefined;
}, {
    from?: string | undefined;
    to?: string | undefined;
}>;
