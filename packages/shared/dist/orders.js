"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusChangeBody = exports.AdminOrderListQuery = exports.OrderListQuery = exports.CreateOrderBody = exports.CartPriceBody = exports.CartItem = exports.canTransition = exports.ORDER_TRANSITIONS = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
const catalog_1 = require("./catalog");
exports.ORDER_TRANSITIONS = {
    new: ["confirmed", "cancelled"],
    confirmed: ["in_production", "cancelled"],
    in_production: ["ready", "cancelled"],
    ready: ["delivered", "cancelled"],
    delivered: [],
    cancelled: [],
};
const canTransition = (from, to) => exports.ORDER_TRANSITIONS[from].includes(to);
exports.canTransition = canTransition;
const BigIdSchema = zod_1.z
    .union([zod_1.z.string().regex(/^\d+$/), zod_1.z.number().int().positive()])
    .transform((v) => BigInt(v));
exports.CartItem = zod_1.z.object({
    variantId: BigIdSchema,
    qty: zod_1.z.number().int().min(1).max(100000),
});
exports.CartPriceBody = zod_1.z.object({
    items: zod_1.z.array(exports.CartItem).min(1).max(50),
    warehouseId: zod_1.z.number().int().positive().optional(),
});
exports.CreateOrderBody = exports.CartPriceBody.extend({
    notes: zod_1.z.string().trim().max(1000).optional(),
});
exports.OrderListQuery = catalog_1.PageQuery.extend({
    status: zod_1.z.enum(enums_1.ORDER_STATUSES).optional(),
});
const day = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
exports.AdminOrderListQuery = exports.OrderListQuery.extend({
    q: zod_1.z.string().trim().max(100).optional(),
    userId: zod_1.z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
    from: day.optional(),
    to: day.optional(), // inclusive
});
exports.StatusChangeBody = zod_1.z.object({
    status: zod_1.z.enum(enums_1.ORDER_STATUSES),
    note: zod_1.z.string().trim().max(255).optional(),
});
