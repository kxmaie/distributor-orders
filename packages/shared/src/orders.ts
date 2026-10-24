import { z } from "zod";
import { ORDER_STATUSES, type OrderStatus } from "./enums";
import { PageQuery } from "./catalog";

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => ORDER_TRANSITIONS[from].includes(to);

const BigIdSchema = z
  .union([z.string().regex(/^\d+$/), z.number().int().positive()])
  .transform((v) => BigInt(v));

export const CartItem = z.object({
  variantId: BigIdSchema,
  qty: z.number().int().min(1).max(100000),
});
export const CartPriceBody = z.object({
  items: z.array(CartItem).min(1).max(50),
  warehouseId: z.number().int().positive().optional(),
});
export const CreateOrderBody = CartPriceBody.extend({
  notes: z.string().trim().max(1000).optional(),
});

export const OrderListQuery = PageQuery.extend({
  status: z.enum(ORDER_STATUSES).optional(),
});
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
export const AdminOrderListQuery = OrderListQuery.extend({
  q: z.string().trim().max(100).optional(),
  userId: z.string().regex(/^\d+$/).transform((v) => BigInt(v)).optional(),
  from: day.optional(),
  to: day.optional(), // inclusive
});
export const StatusChangeBody = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(255).optional(),
});
