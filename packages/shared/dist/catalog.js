"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementQuery = exports.StockListQuery = exports.StockAdjustBody = exports.WarehouseUpdate = exports.WarehouseCreate = exports.VariantUpdate = exports.VariantCreate = exports.AdminProductQuery = exports.ProductUpdate = exports.ProductCreate = exports.CategoryUpdate = exports.CategoryCreate = exports.CatalogListQuery = exports.PageQuery = exports.SignedMoney = exports.Money = exports.IntIdParam = exports.IdParam = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
const bigId = zod_1.z.union([zod_1.z.string().regex(/^\d+$/), zod_1.z.number().int().positive()]).transform((v) => BigInt(v));
exports.IdParam = zod_1.z.object({ id: zod_1.z.string().regex(/^\d+$/).transform((v) => BigInt(v)) });
exports.IntIdParam = zod_1.z.object({ id: zod_1.z.coerce.number().int().positive() });
exports.Money = zod_1.z
    .union([zod_1.z.number(), zod_1.z.string()])
    .transform((v) => String(v).trim())
    .refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v), "Invalid amount (max 2 decimals)");
exports.SignedMoney = zod_1.z
    .union([zod_1.z.number(), zod_1.z.string()])
    .transform((v) => String(v).trim())
    .refine((v) => /^-?\d{1,10}(\.\d{1,2})?$/.test(v), "Invalid amount (max 2 decimals)");
exports.PageQuery = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
const slug = zod_1.z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120);
exports.CatalogListQuery = exports.PageQuery.extend({
    category: zod_1.z.string().trim().max(120).optional(), // id or slug
    q: zod_1.z.string().trim().max(100).optional(),
});
exports.CategoryCreate = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(100),
    slug: slug.optional(),
    sortOrder: zod_1.z.number().int().default(0),
});
exports.CategoryUpdate = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(100),
    slug,
    sortOrder: zod_1.z.number().int(),
    isActive: zod_1.z.boolean(),
}).partial();
exports.ProductCreate = zod_1.z.object({
    categoryId: zod_1.z.number().int().positive(),
    name: zod_1.z.string().trim().min(1).max(160),
    description: zod_1.z.string().max(5000).nullable().optional(),
    imageUrl: zod_1.z.string().max(500).nullable().optional(),
    basePrice: exports.Money,
    unit: zod_1.z.enum(enums_1.UNITS).default("piece"),
    warehouseId: zod_1.z.coerce.number().int().positive().optional(),
    initialStock: zod_1.z.coerce.number().int().min(0).max(1_000_000).optional(),
    sku: zod_1.z.string().trim().max(60).optional(),
    variantLabel: zod_1.z.string().trim().max(120).optional(),
});
exports.ProductUpdate = zod_1.z.object({
    categoryId: zod_1.z.number().int().positive(),
    name: zod_1.z.string().trim().min(1).max(160),
    description: zod_1.z.string().max(5000).nullable(),
    imageUrl: zod_1.z.string().max(500).nullable(),
    basePrice: exports.Money,
    unit: zod_1.z.enum(enums_1.UNITS),
    isActive: zod_1.z.boolean(),
    warehouseId: zod_1.z.coerce.number().int().positive().optional(),
    stockAdjust: zod_1.z.coerce.number().int().optional(),
}).partial();
exports.AdminProductQuery = exports.PageQuery.extend({
    category: zod_1.z.string().trim().max(120).optional(),
    q: zod_1.z.string().trim().max(100).optional(),
    active: zod_1.z.enum(["true", "false"]).optional(),
});
const sku = zod_1.z.string().regex(/^[A-Za-z0-9._-]{1,60}$/);
exports.VariantCreate = zod_1.z.object({
    productId: bigId,
    sku: zod_1.z.string().trim().min(1).max(60).optional(),
    label: zod_1.z.string().trim().min(1).max(120),
    priceDelta: exports.SignedMoney.default("0"),
    warehouseId: zod_1.z.coerce.number().int().positive().optional(),
    initialStock: zod_1.z.coerce.number().int().min(0).max(1_000_000).optional(),
});
exports.VariantUpdate = zod_1.z.object({
    sku,
    label: zod_1.z.string().trim().min(1).max(120),
    priceDelta: exports.SignedMoney,
    isActive: zod_1.z.boolean(),
}).partial();
exports.WarehouseCreate = zod_1.z.object({ name: zod_1.z.string().trim().min(1).max(80) });
exports.WarehouseUpdate = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80),
    isActive: zod_1.z.boolean(),
}).partial();
exports.StockAdjustBody = zod_1.z.object({
    variantId: bigId,
    warehouseId: zod_1.z.number().int().positive(),
    delta: zod_1.z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 1_000_000, "delta must be non-zero, |delta| <= 1,000,000"),
    type: zod_1.z.enum(["receipt", "adjustment"]).default("adjustment"),
    note: zod_1.z.string().trim().max(255).optional(),
});
exports.StockListQuery = exports.PageQuery.extend({
    warehouseId: zod_1.z.coerce.number().int().positive().optional(),
    variantId: zod_1.z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
    q: zod_1.z.string().trim().max(100).optional(),
});
exports.MovementQuery = exports.PageQuery.extend({
    warehouseId: zod_1.z.coerce.number().int().positive().optional(),
    variantId: zod_1.z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
    type: zod_1.z.enum(enums_1.MOVEMENT_TYPES).optional(),
});
