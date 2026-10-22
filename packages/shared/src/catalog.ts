import { z } from "zod";
import { UNITS, MOVEMENT_TYPES } from "./enums";

const bigId = z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).transform((v) => BigInt(v));
export const IdParam = z.object({ id: z.string().regex(/^\d+$/).transform((v) => BigInt(v)) });
export const IntIdParam = z.object({ id: z.coerce.number().int().positive() });

export const Money = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Invalid amount (max 2 decimals)");
export const SignedMoney = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .refine((v) => /^-?\d{1,10}(\.\d{1,2})?$/.test(v), "Invalid amount (max 2 decimals)");

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);

export const CatalogListQuery = PageQuery.extend({
  category: z.string().trim().max(120).optional(), // id or slug
  q: z.string().trim().max(100).optional(),
});

export const CategoryCreate = z.object({
  name: z.string().trim().min(1).max(100),
  slug: slug.optional(),
  sortOrder: z.number().int().default(0),
});
export const CategoryUpdate = z.object({
  name: z.string().trim().min(1).max(100),
  slug,
  sortOrder: z.number().int(),
  isActive: z.boolean(),
}).partial();

export const ProductCreate = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(5000).nullable().optional(),
  imageUrl: z.string().max(500).nullable().optional(),
  basePrice: Money,
  unit: z.enum(UNITS).default("piece"),
  warehouseId: z.coerce.number().int().positive().optional(),
  initialStock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  sku: z.string().trim().max(60).optional(),
  variantLabel: z.string().trim().max(120).optional(),
});
export const ProductUpdate = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(5000).nullable(),
  imageUrl: z.string().max(500).nullable(),
  basePrice: Money,
  unit: z.enum(UNITS),
  isActive: z.boolean(),
  warehouseId: z.coerce.number().int().positive().optional(),
  stockAdjust: z.coerce.number().int().optional(),
}).partial();
export const AdminProductQuery = PageQuery.extend({
  category: z.string().trim().max(120).optional(),
  q: z.string().trim().max(100).optional(),
  active: z.enum(["true", "false"]).optional(),
});

const sku = z.string().regex(/^[A-Za-z0-9._-]{1,60}$/);
export const VariantCreate = z.object({
  productId: bigId,
  sku: z.string().trim().min(1).max(60).optional(),
  label: z.string().trim().min(1).max(120),
  priceDelta: SignedMoney.default("0"),
  warehouseId: z.coerce.number().int().positive().optional(),
  initialStock: z.coerce.number().int().min(0).max(1_000_000).optional(),
});
export const VariantUpdate = z.object({
  sku,
  label: z.string().trim().min(1).max(120),
  priceDelta: SignedMoney,
  isActive: z.boolean(),
}).partial();

export const WarehouseCreate = z.object({ name: z.string().trim().min(1).max(80) });
export const WarehouseUpdate = z.object({
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean(),
}).partial();

export const StockAdjustBody = z.object({
  variantId: bigId,
  warehouseId: z.number().int().positive(),
  delta: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 1_000_000, "delta must be non-zero, |delta| <= 1,000,000"),
  type: z.enum(["receipt", "adjustment"]).default("adjustment"),
  note: z.string().trim().max(255).optional(),
});
export const StockListQuery = PageQuery.extend({
  warehouseId: z.coerce.number().int().positive().optional(),
  variantId: z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
  q: z.string().trim().max(100).optional(),
});
export const MovementQuery = PageQuery.extend({
  warehouseId: z.coerce.number().int().positive().optional(),
  variantId: z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
  type: z.enum(MOVEMENT_TYPES).optional(),
});
