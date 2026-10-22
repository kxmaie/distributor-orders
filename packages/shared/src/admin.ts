import { z } from "zod";
import { PASSWORD_MIN_LENGTH, RoleSchema } from "./auth";
import { PageQuery } from "./catalog";
import { PASSWORD_REQUEST_STATUSES } from "./enums";

export const Pct = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v), "Invalid percent")
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, "Percent must be 0–100");

const phone = z
  .union([z.string().trim().max(20), z.null()])
  .transform((v) => (v === "" ? null : v));

const Password = z.string().min(PASSWORD_MIN_LENGTH).max(200);

export const UserListQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  role: RoleSchema.optional(),
  active: z.enum(["true", "false"]).optional(),
  pending: z.enum(["true", "false"]).optional(),
});

export const UserApproveBody = z.object({
  defaultDiscountPct: Pct.optional(),
});
export type UserApproveBody = z.infer<typeof UserApproveBody>;

export const UserCreate = z.object({
  username: z.string().trim().min(3).max(60),
  password: Password,
  fullName: z.string().trim().min(1).max(120),
  phone: phone.optional(),
  role: RoleSchema.default("distributor"),
  defaultDiscountPct: Pct.default("0"),
});

export const UserUpdate = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    phone,
    role: RoleSchema,
    defaultDiscountPct: Pct,
    isActive: z.boolean(),
    password: Password,
    unlock: z.literal(true),
  })
  .partial();

export const PasswordRequestQuery = PageQuery.extend({
  status: z.enum(PASSWORD_REQUEST_STATUSES).optional(),
});

export const PasswordResolveBody = z
  .object({
    status: z.enum(["resolved", "rejected"]),
    newPassword: Password.optional(),
  })
  .superRefine((b, ctx) => {
    if (b.status === "resolved" && !b.newPassword) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "newPassword is required when resolving" });
    }
  });

const optionalBig = z
  .union([z.string().regex(/^\d+$/), z.number().int().positive(), z.null()])
  .optional()
  .transform((v) => (v == null || v === undefined ? null : BigInt(v)));

const optionalInt = z.number().int().positive().nullable().optional();

const isoDate = z
  .string()
  .trim()
  .min(10)
  .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");

export const DiscountListQuery = PageQuery.extend({
  userId: z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
  active: z.enum(["true", "false"]).optional(),
});

export const DiscountCreate = z.object({
  userId: optionalBig,
  categoryId: optionalInt,
  productId: optionalBig,
  pct: Pct,
  startsAt: isoDate.nullable().optional(),
  endsAt: isoDate.nullable().optional(),
  isActive: z.boolean().default(true),
});

export const DiscountUpdate = DiscountCreate.partial();

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
export const ReportsQuery = z.object({
  from: day.optional(),
  to: day.optional(),
});
