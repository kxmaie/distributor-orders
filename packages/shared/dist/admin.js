"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsQuery = exports.DiscountUpdate = exports.DiscountCreate = exports.DiscountListQuery = exports.PasswordResolveBody = exports.PasswordRequestQuery = exports.UserUpdate = exports.UserCreate = exports.UserApproveBody = exports.UserListQuery = exports.Pct = void 0;
const zod_1 = require("zod");
const auth_1 = require("./auth");
const catalog_1 = require("./catalog");
const enums_1 = require("./enums");
exports.Pct = zod_1.z
    .union([zod_1.z.number(), zod_1.z.string()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), "Invalid percent")
    .refine((v) => Number(v) >= 0 && Number(v) <= 100, "Percent must be 0–100");
const phone = zod_1.z
    .union([zod_1.z.string().trim().max(20), zod_1.z.null()])
    .transform((v) => (v === "" ? null : v));
const Password = zod_1.z.string().min(auth_1.PASSWORD_MIN_LENGTH).max(200);
exports.UserListQuery = catalog_1.PageQuery.extend({
    q: zod_1.z.string().trim().max(100).optional(),
    role: auth_1.RoleSchema.optional(),
    active: zod_1.z.enum(["true", "false"]).optional(),
    pending: zod_1.z.enum(["true", "false"]).optional(),
});
exports.UserApproveBody = zod_1.z.object({
    defaultDiscountPct: exports.Pct.optional(),
});
exports.UserCreate = zod_1.z.object({
    username: zod_1.z.string().trim().min(3).max(60),
    password: Password,
    fullName: zod_1.z.string().trim().min(1).max(120),
    phone: phone.optional(),
    role: auth_1.RoleSchema.default("distributor"),
    defaultDiscountPct: exports.Pct.default("0"),
});
exports.UserUpdate = zod_1.z
    .object({
    fullName: zod_1.z.string().trim().min(1).max(120),
    phone,
    role: auth_1.RoleSchema,
    defaultDiscountPct: exports.Pct,
    isActive: zod_1.z.boolean(),
    password: Password,
    unlock: zod_1.z.literal(true),
})
    .partial();
exports.PasswordRequestQuery = catalog_1.PageQuery.extend({
    status: zod_1.z.enum(enums_1.PASSWORD_REQUEST_STATUSES).optional(),
});
exports.PasswordResolveBody = zod_1.z
    .object({
    status: zod_1.z.enum(["resolved", "rejected"]),
    newPassword: Password.optional(),
})
    .superRefine((b, ctx) => {
    if (b.status === "resolved" && !b.newPassword) {
        ctx.addIssue({ code: "custom", path: ["newPassword"], message: "newPassword is required when resolving" });
    }
});
const optionalBig = zod_1.z
    .union([zod_1.z.string().regex(/^\d+$/), zod_1.z.number().int().positive(), zod_1.z.null()])
    .optional()
    .transform((v) => (v == null || v === undefined ? null : BigInt(v)));
const optionalInt = zod_1.z.number().int().positive().nullable().optional();
const isoDate = zod_1.z
    .string()
    .trim()
    .min(10)
    .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");
exports.DiscountListQuery = catalog_1.PageQuery.extend({
    userId: zod_1.z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
    active: zod_1.z.enum(["true", "false"]).optional(),
});
exports.DiscountCreate = zod_1.z.object({
    userId: optionalBig,
    categoryId: optionalInt,
    productId: optionalBig,
    pct: exports.Pct,
    startsAt: isoDate.nullable().optional(),
    endsAt: isoDate.nullable().optional(),
    isActive: zod_1.z.boolean().default(true),
});
exports.DiscountUpdate = exports.DiscountCreate.partial();
const day = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
exports.ReportsQuery = zod_1.z.object({
    from: day.optional(),
    to: day.optional(),
});
