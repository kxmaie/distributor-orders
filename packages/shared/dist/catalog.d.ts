import { z } from "zod";
export declare const IdParam: z.ZodObject<{
    id: z.ZodEffects<z.ZodString, bigint, string>;
}, "strip", z.ZodTypeAny, {
    id: bigint;
}, {
    id: string;
}>;
export declare const IntIdParam: z.ZodObject<{
    id: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
}, {
    id: number;
}>;
export declare const Money: z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>;
export declare const SignedMoney: z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>;
export declare const PageQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const CatalogListQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    category: z.ZodOptional<z.ZodString>;
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    category?: string | undefined;
    q?: string | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    category?: string | undefined;
    q?: string | undefined;
}>;
export declare const CategoryCreate: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sortOrder: number;
    slug?: string | undefined;
}, {
    name: string;
    slug?: string | undefined;
    sortOrder?: number | undefined;
}>;
export declare const CategoryUpdate: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    slug?: string | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    slug?: string | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const ProductCreate: z.ZodObject<{
    categoryId: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    basePrice: z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>;
    unit: z.ZodDefault<z.ZodEnum<["piece", "meter", "sqm"]>>;
    warehouseId: z.ZodOptional<z.ZodNumber>;
    initialStock: z.ZodOptional<z.ZodNumber>;
    sku: z.ZodOptional<z.ZodString>;
    variantLabel: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    categoryId: number;
    basePrice: string;
    unit: "piece" | "meter" | "sqm";
    description?: string | null | undefined;
    imageUrl?: string | null | undefined;
    warehouseId?: number | undefined;
    initialStock?: number | undefined;
    sku?: string | undefined;
    variantLabel?: string | undefined;
}, {
    name: string;
    categoryId: number;
    basePrice: string | number;
    description?: string | null | undefined;
    imageUrl?: string | null | undefined;
    unit?: "piece" | "meter" | "sqm" | undefined;
    warehouseId?: number | undefined;
    initialStock?: number | undefined;
    sku?: string | undefined;
    variantLabel?: string | undefined;
}>;
export declare const ProductUpdate: z.ZodObject<{
    categoryId: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    basePrice: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>>;
    unit: z.ZodOptional<z.ZodEnum<["piece", "meter", "sqm"]>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    warehouseId: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    stockAdjust: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    categoryId?: number | undefined;
    description?: string | null | undefined;
    imageUrl?: string | null | undefined;
    basePrice?: string | undefined;
    unit?: "piece" | "meter" | "sqm" | undefined;
    warehouseId?: number | undefined;
    stockAdjust?: number | undefined;
}, {
    name?: string | undefined;
    isActive?: boolean | undefined;
    categoryId?: number | undefined;
    description?: string | null | undefined;
    imageUrl?: string | null | undefined;
    basePrice?: string | number | undefined;
    unit?: "piece" | "meter" | "sqm" | undefined;
    warehouseId?: number | undefined;
    stockAdjust?: number | undefined;
}>;
export declare const AdminProductQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    category: z.ZodOptional<z.ZodString>;
    q: z.ZodOptional<z.ZodString>;
    active: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    active?: "true" | "false" | undefined;
    category?: string | undefined;
    q?: string | undefined;
}, {
    active?: "true" | "false" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    category?: string | undefined;
    q?: string | undefined;
}>;
export declare const VariantCreate: z.ZodObject<{
    productId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, bigint, string | number>;
    sku: z.ZodOptional<z.ZodString>;
    label: z.ZodString;
    priceDelta: z.ZodDefault<z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>>;
    warehouseId: z.ZodOptional<z.ZodNumber>;
    initialStock: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    productId: bigint;
    label: string;
    priceDelta: string;
    warehouseId?: number | undefined;
    initialStock?: number | undefined;
    sku?: string | undefined;
}, {
    productId: string | number;
    label: string;
    warehouseId?: number | undefined;
    initialStock?: number | undefined;
    sku?: string | undefined;
    priceDelta?: string | number | undefined;
}>;
export declare const VariantUpdate: z.ZodObject<{
    sku: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    priceDelta: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodUnion<[z.ZodNumber, z.ZodString]>, string, string | number>, string, string | number>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive?: boolean | undefined;
    sku?: string | undefined;
    label?: string | undefined;
    priceDelta?: string | undefined;
}, {
    isActive?: boolean | undefined;
    sku?: string | undefined;
    label?: string | undefined;
    priceDelta?: string | number | undefined;
}>;
export declare const WarehouseCreate: z.ZodObject<{
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
}, {
    name: string;
}>;
export declare const WarehouseUpdate: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    isActive?: boolean | undefined;
}>;
export declare const StockAdjustBody: z.ZodObject<{
    variantId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, bigint, string | number>;
    warehouseId: z.ZodNumber;
    delta: z.ZodEffects<z.ZodNumber, number, number>;
    type: z.ZodDefault<z.ZodEnum<["receipt", "adjustment"]>>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "receipt" | "adjustment";
    warehouseId: number;
    variantId: bigint;
    delta: number;
    note?: string | undefined;
}, {
    warehouseId: number;
    variantId: string | number;
    delta: number;
    type?: "receipt" | "adjustment" | undefined;
    note?: string | undefined;
}>;
export declare const StockListQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    warehouseId: z.ZodOptional<z.ZodNumber>;
    variantId: z.ZodOptional<z.ZodEffects<z.ZodString, bigint, string>>;
    q: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    q?: string | undefined;
    warehouseId?: number | undefined;
    variantId?: bigint | undefined;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
    q?: string | undefined;
    warehouseId?: number | undefined;
    variantId?: string | undefined;
}>;
export declare const MovementQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    warehouseId: z.ZodOptional<z.ZodNumber>;
    variantId: z.ZodOptional<z.ZodEffects<z.ZodString, bigint, string>>;
    type: z.ZodOptional<z.ZodEnum<["receipt", "adjustment", "reserve", "release", "ship"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    type?: "receipt" | "adjustment" | "reserve" | "release" | "ship" | undefined;
    warehouseId?: number | undefined;
    variantId?: bigint | undefined;
}, {
    type?: "receipt" | "adjustment" | "reserve" | "release" | "ship" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    warehouseId?: number | undefined;
    variantId?: string | undefined;
}>;
