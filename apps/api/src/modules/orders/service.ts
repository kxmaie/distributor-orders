import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { canTransition, type AdminOrderListQuery, type CartPriceBody, type CreateDeliveryBody, type CreateOrderBody, type OrderListQuery, type OrderStatus } from "@do/shared";
import { prisma } from "../../lib/db";
import { averageUnitCost, postVoucher } from "../accounting/ledger";
import { HttpError } from "../../lib/errors";
import { toJson } from "../../lib/json";
import { wakeWorker } from "../../lib/worker";
import { calcLine, findWarehouses, priceItems, type PricedLine } from "./pricing";
import { formatOrderNo } from "./utils";

type CartBody = z.output<typeof CartPriceBody>;
type CreateBody = z.output<typeof CreateOrderBody>;
type ListQ = z.output<typeof OrderListQuery>;
type AdminListQ = z.output<typeof AdminOrderListQuery>;

const TX_OPTS = { maxWait: 5000, timeout: 20000 };
const money = (d: Prisma.Decimal) => d.toFixed(2);

type Tx = Prisma.TransactionClient;
type NotifRow = { channel: "whatsapp" | "in_app"; recipient: string; payload: string };

/** One in-app (SSE) row per user id; WhatsApp is sent only after explicit opt-in. */
function notifyUsers(users: { id: bigint; phone: string | null; whatsappOptInAt: Date | null }[], payload: string, opts: { whatsapp: boolean }): NotifRow[] {
  const rows: NotifRow[] = [];
  for (const u of users) {
    rows.push({ channel: "in_app", recipient: u.id.toString(), payload });
    if (opts.whatsapp && u.whatsappOptInAt && u.phone?.trim()) rows.push({ channel: "whatsapp", recipient: u.phone.trim(), payload });
  }
  return rows;
}

const activeAdmins = (tx: Tx) =>
  tx.user.findMany({ where: { isActive: true, role: { in: ["admin", "super_admin"] } }, select: { id: true, phone: true, whatsappOptInAt: true } });

const orderInclude = {
  items: { orderBy: { id: "asc" }, include: { variant: { select: { sku: true, product: { select: { id: true, unit: true, piecesPerUnit: true } } } } } },
  history: { orderBy: { id: "asc" } },
  deliveries: { orderBy: { deliveredAt: "desc" }, include: { items: true } },
  warehouse: { select: { id: true, name: true } },
  user: { select: { id: true, username: true, fullName: true, phone: true } },
} satisfies Prisma.OrderInclude;
type OrderFull = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function shapeOrder(o: OrderFull, admin: boolean) {
  return {
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    warehouse: o.warehouse,
    subtotal: money(o.subtotal),
    discountTotal: money(o.discountTotal),
    adminDiscount: money(o.adminDiscount),
    total: money(o.total),
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: o.items.map((i) => ({
      id: i.id, variantId: i.variantId, productName: i.productName, variantLabel: i.variantLabel,
      sku: i.variant.sku, productId: i.variant.product.id, unit: i.variant.product.unit, piecesPerUnit: i.variant.product.piecesPerUnit,
      unitPrice: money(i.unitPrice), discountPct: money(i.discountPct), qty: i.qty, lineTotal: money(i.lineTotal),
    })),
    deliveries: o.deliveries.map((d) => ({
      id: d.id.toString(), trackingNumber: d.trackingNumber, note: d.note, deliveredAt: d.deliveredAt,
      amount: money(d.items.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0))),
      items: d.items.map((item) => ({ orderItemId: item.orderItemId.toString(), qty: item.qty, amount: money(item.amount) })),
    