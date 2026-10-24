import type { OrderStatus } from "@do/shared";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "جديد",
  confirmed: "تم التأكيد",
  ready: "جاهز للاستلام",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};
export const STATUS_CLASS: Record<OrderStatus, string> = {
  new: "bg-primary/15 text-primary",
  confirmed: "bg-accent/15 text-accent",
  ready: "bg-accent/15 text-accent",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-danger/15 text-danger",
};
export const FLOW: OrderStatus[] = ["new", "confirmed", "ready", "delivered"];
