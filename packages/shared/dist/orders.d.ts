import { z } from "zod";
import { type OrderStatus } from "./enums";
export declare const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]>;
export declare const canTransition: (from: OrderStatus, to: OrderStatus) => boolean;
export declare const CartItem: z.ZodObject<{
    variantId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, bigint, string | number>;
    qty: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    variantId: bigint;
    qty: number;
}, {
    variantId: string | number;
    qty: number;
}>;
export declare const CartPriceBody: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        variantId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, bigint, string | number>;
        qty: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        variantId: bigint;
        qty: number;
    }, {
        variantId: string | number;
        qty: number;
    }>, "many">;
    warehouseId: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    items: {
        variantId: bigint;
        qty: number;
    }[];
    warehouseId?: number | undefined;
}, {
    items: {
        variantId: string | number;
        qty: number;
    }[];
    warehouseId?: number | undefined;
}>;
export declare const CreateOrderBody: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        variantId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodNumber]>, bigint, string | number>;
        qty: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        variantId: bigint;
        qty: number;
    }, {
        variantId: string | number;
        qty: number;
    }>, "many">;
    warehouseId: z.ZodOptional<z.ZodNumber>;
} & {
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: {
        variantId: bigint;
        qty: number;
    }[];
    warehouseId?: number | undefined;
    notes?: string | undefined;
}, {
    items: {
        variantId: string | number;
        qty: number;
    }[];
    warehouseId?: number | undefined;
    notes?: string | undefined;
}>;
export declare const OrderListQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["new", "confirmed", "ready", "delivered", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "new" | "confirmed" | "ready" | "delivered" | "cancelled" | undefined;
}, {
    status?: "new" | "confirmed" | "ready" | "delivered" | "cancelled" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export declare const AdminOrderListQuery: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
} & {
    status: z.ZodOptional<z.ZodEnum<["new", "confirmed", "ready", "delivered", "cancelled"]>>;
} & {
    q: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodEffects<z.ZodString, bigint, string>>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
    status?: "new" | "confirmed" | "ready" | "delivered" | "cancelled" | undefined;
    q?: string | undefined;
    userId?: bigint | undefined;
    from?: string | undefined;
    to?: string | undefined;
}, {
    status?: "new" | "confirmed" | "ready" | "delivered" | "cancelled" | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
    q?: string | undefined;
    userId?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
}>;
export declare const StatusChangeBody: z.ZodObject<{
    status: z.ZodEnum<["new", "confirmed", "ready", "delivered", "cancelled"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "new" | "confirmed" | "ready" | "delivered" | "cancelled";
    note?: string | undefined;
}, {
    status: "new" | "confirmed" | "ready" | "delivered" | "cancelled";
    note?: string | undefined;
}>;
