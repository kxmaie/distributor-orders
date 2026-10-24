import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { canTransition, type AdminOrderListQuery, type CartPriceBody, type CreateDeliveryBody, type CreateOrderBody, type OrderListQuery, type OrderStatus } from "@do/shared";
import { prisma } from "../../lib/db";
import { HttpError } from "../../lib/errors";
import { toJson } from "../../lib/json";
import { wakeWorker } from "../../lib/worker";
import { findWarehouses, priceItems, type PricedLine } from "./pricing";
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
    })),
    // Distributors get the timeline only (no admin ids / internal notes)
    history: o.history.map((h) =>
      admin
        ? { fromStatus: h.fromStatus, toStatus: h.toStatus, changedBy: h.changedBy, note: h.note, createdAt: h.createdAt }
        : { fromStatus: h.fromStatus, toStatus: h.toStatus, createdAt: h.createdAt },
    ),
    ...(admin ? { user: o.user } : {}),
  };
}

const summaryInclude = {
  warehouse: { select: { id: true, name: true } },
  user: { select: { id: true, username: true, fullName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderInclude;
type OrderSummary = Prisma.OrderGetPayload<{ include: typeof summaryInclude }>;
const shapeSummary = (o: OrderSummary, admin: boolean) => ({
  id: o.id, orderNo: o.orderNo, status: o.status, warehouse: o.warehouse,
  itemCount: o._count.items, subtotal: money(o.subtotal), discountTotal: money(o.discountTotal),
  total: money(o.total), createdAt: o.createdAt, updatedAt: o.updatedAt,
  ...(admin ? { user: o.user } : {}),
});

const fmtLine = (l: PricedLine) => ({
  variantId: l.variantId, sku: l.sku, productName: l.productName, variantLabel: l.variantLabel,
  unitPrice: money(l.unitPrice), discountPct: money(l.discountPct), qty: l.qty, lineTotal: money(l.lineTotal),
});

// ---------------------------------------------------------------- pricing
export async function priceCart(userId: bigint, body: CartBody) {
  const limit = Number((await prisma.appSetting.findUnique({ where: { key: "max_order_items" } }))?.value ?? 20);
  if (new Set(body.items.map((item) => item.variantId.toString())).size > limit) throw new HttpError(400, "ORDER_ITEM_LIMIT", `الحد الأقصى للأصناف في الطلب هو ${limit}`);
  const priced = await priceItems(prisma, userId, body.items);
  const { fulfillable, shortages } = await findWarehouses(prisma, priced.lines, body.warehouseId);
  return {
    lines: priced.lines.map(fmtLine),
    subtotal: money(priced.subtotal),
    discountTotal: money(priced.discountTotal),
    total: money(priced.total),
    fulfillableWarehouses: fulfillable,
    shortages,
  };
}

// ---------------------------------------------------------------- create
async function ensureCounter(year: number) {
  const ex = await prisma.orderCounter.findUnique({ where: { year } });
  if (ex) return;
  try {
    await prisma.orderCounter.create({ data: { year, lastNo: 0 } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
}

const stockError = (shortages?: unknown) =>
  new HttpError(409, "INSUFFICIENT_STOCK", "Not enough stock to fulfil this order", shortages);

export async function createOrder(userId: bigint, body: CreateBody, ip?: string) {
  const limitSetting = await prisma.appSetting.findUnique({ where: { key: "max_order_items" } });
  const maxOrderItems = Number(limitSetting?.value ?? 20);
  const distinctItems = new Set(body.items.map((item) => item.variantId.toString())).size;
  if (distinctItems > maxOrderItems) throw new HttpError(400, "ORDER_ITEM_LIMIT", `الحد الأقصى للأصناف في الطلب هو ${maxOrderItems}`);
  // 1) Pre-check outside the transaction: pick the warehouse (first one that can fulfil everything)
  const pre = await priceItems(prisma, userId, body.items);
  const fit = await findWarehouses(prisma, pre.lines, body.warehouseId);
  const warehouse = fit.fulfillable[0];
  if (!warehouse) {
    throw fit.shortages.length
      ? stockError(fit.shortages)
      : new HttpError(409, "NO_SINGLE_WAREHOUSE", "No single warehouse can fulfil all items; split the order");
  }

  const year = new Date().getUTCFullYear();
  await ensureCounter(year);

  const orderId = await prisma.$transaction(async (tx) => {
    // 2) Re-price inside the transaction (prices may have changed since the pre-check)
    const priced = await priceItems(tx, userId, body.items);

    // 3) Order number: the UPDATE takes a row lock on the counter until commit (serializes numbering)
    const counter = await tx.orderCounter.update({ where: { year }, data: { lastNo: { increment: 1 } } });
    const orderNo = formatOrderNo(year, counter.lastNo);

    const order = await tx.order.create({
      data: {
        orderNo,
        userId,
        warehouseId: warehouse.id,
        subtotal: priced.subtotal,
        discountTotal: priced.discountTotal,
        total: priced.total,
        notes: body.notes,
        items: {
          create: priced.lines.map((l) => ({
            variantId: l.variantId, productName: l.productName, variantLabel: l.variantLabel,
            unitPrice: l.unitPrice, discountPct: l.discountPct, qty: l.qty, lineTotal: l.lineTotal,
          })),
        },
        history: { create: { fromStatus: null, toStatus: "new", changedBy: userId } },
      },
      select: { id: true },
    });

    // 4) Reserve stock: one atomic conditional UPDATE per line (lines are sorted by variant id)
    for (const l of priced.lines) {
      const n = await tx.$executeRaw`
        UPDATE stock_levels SET reserved = reserved + ${l.qty}
        WHERE variant_id = ${l.variantId} AND warehouse_id = ${warehouse.id}
          AND on_hand - reserved >= ${l.qty}`;
      if (n !== 1) throw stockError([{ variantId: l.variantId, sku: l.sku, requested: l.qty }]);
    }
    await tx.reservation.createMany({
      data: priced.lines.map((l) => ({
        orderId: order.id, variantId: l.variantId, warehouseId: warehouse.id, qty: l.qty,
      })),
    });
    await tx.stockMovement.createMany({
      data: priced.lines.map((l) => ({
        variantId: l.variantId, warehouseId: warehouse.id, type: "reserve", qty: l.qty,
        refType: "order", refId: order.id, createdBy: userId,
      })),
    });

    // 5) Notify every active admin: in-app (SSE → toast + bell) and WhatsApp (if they have a phone).
    //    Rows are written in the same transaction, so they exist iff the order does.
    const me = await tx.user.findUnique({ where: { id: userId }, select: { fullName: true } });
    const admins = await activeAdmins(tx);
    if (admins.length) {
      const payload = toJson({
        type: "order_created", orderId: order.id, orderNo,
        total: money(priced.total), distributor: me?.fullName,
      });
      await tx.notificationQueue.createMany({ data: notifyUsers(admins, payload, { whatsapp: true }) });
    }

    await tx.auditLog.create({
      data: {
        actorId: userId, action: "order.create", entity: "order", entityId: order.id.toString(),
        meta: toJson({ orderNo, total: money(priced.total), warehouseId: warehouse.id }), ip,
      },
    });
    return order.id;
  }, TX_OPTS);

  wakeWorker(); // deliver SSE / WhatsApp now instead of waiting for the next poll
  return getOrder(orderId, { ownerId: userId });
}

export async function updateOwnOrder(orderId: bigint, userId: bigint, body: CreateBody, ip?: string) {
  const limitSetting = await prisma.appSetting.findUnique({ where: { key: "max_order_items" } });
  const maxItems = Number(limitSetting?.value ?? 20);
  if (new Set(body.items.map((item) => item.variantId.toString())).size > maxItems) throw new HttpError(400, "ORDER_ITEM_LIMIT", `الحد الأقصى للأصناف في الطلب هو ${maxItems}`);
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, userId }, include: { reservations: { where: { status: "active" } } } });
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
    if (order.status !== "new") throw new HttpError(409, "ORDER_ALREADY_CONFIRMED", "لا يمكن تعديل الطلب بعد اعتماده");
    const priced = await priceItems(tx, userId, body.items);
    const existing = new Map(order.reservations.map((r) => [r.variantId.toString(), r]));
    const next = new Map(priced.lines.map((line) => [line.variantId.toString(), line]));
    for (const key of [...new Set([...existing.keys(), ...next.keys()])].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1)) {
      const old = existing.get(key); const line = next.get(key);
      const oldQty = old?.qty ?? 0; const nextQty = line?.qty ?? 0; const delta = nextQty - oldQty;
      if (delta > 0) {
        const count = await tx.$executeRaw`UPDATE stock_levels SET reserved = reserved + ${delta} WHERE variant_id = ${BigInt(key)} AND warehouse_id = ${order.warehouseId} AND on_hand - reserved >= ${delta}`;
        if (count !== 1) throw stockError([{ variantId: BigInt(key), requested: nextQty }]);
      } else if (delta < 0) {
        const count = await tx.$executeRaw`UPDATE stock_levels SET reserved = reserved - ${-delta} WHERE variant_id = ${BigInt(key)} AND warehouse_id = ${order.warehouseId} AND reserved >= ${-delta}`;
        if (count !== 1) throw new HttpError(500, "STOCK_INCONSISTENT");
      }
      if (line) {
        if (old) await tx.reservation.update({ where: { id: old.id }, data: { qty: nextQty, status: "active" } });
        else await tx.reservation.create({ data: { orderId, variantId: line.variantId, warehouseId: order.warehouseId, qty: nextQty } });
      } else if (old) await tx.reservation.update({ where: { id: old.id }, data: { status: "released" } });
      if (delta !== 0) await tx.stockMovement.create({ data: { variantId: BigInt(key), warehouseId: order.warehouseId, type: delta > 0 ? "reserve" : "release", qty: delta > 0 ? delta : delta, refType: "order", refId: orderId, createdBy: userId, note: "تعديل أصناف الطلب قبل الاعتماد" } });
    }
    await tx.orderItem.deleteMany({ where: { orderId } });
    await tx.orderItem.createMany({ data: priced.lines.map((line) => ({ orderId, variantId: line.variantId, productName: line.productName, variantLabel: line.variantLabel, unitPrice: line.unitPrice, discountPct: line.discountPct, qty: line.qty, lineTotal: line.lineTotal })) });
    const changed = await tx.order.updateMany({ where: { id: orderId, userId, status: "new" }, data: { subtotal: priced.subtotal, discountTotal: priced.discountTotal, total: priced.total, notes: body.notes } });
    if (changed.count !== 1) throw new HttpError(409, "CONFLICT");
    await tx.auditLog.create({ data: { actorId: userId, action: "order.update", entity: "order", entityId: orderId.toString(), meta: toJson({ itemCount: priced.lines.length, total: money(priced.total) }), ip } });
  }, TX_OPTS);
  return getOrder(orderId, { ownerId: userId });
}
// ---------------------------------------------------------------- read
export async function getOrder(id: bigint, opts: { ownerId?: bigint; admin?: boolean } = {}) {
  const o = await prisma.order.findFirst({
    where: { id, ...(opts.ownerId ? { userId: opts.ownerId } : {}) }, // not-yours => 404 (no IDOR leak)
    include: orderInclude,
  });
  if (!o) throw new HttpError(404, "ORDER_NOT_FOUND");
  return shapeOrder(o, !!opts.admin);
}

export async function listMyOrders(userId: bigint, q: ListQ) {
  const where: Prisma.OrderWhereInput = { userId, ...(q.status ? { status: q.status } : {}) };
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, include: summaryInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (q.page - 1) * q.pageSize, take: q.pageSize,
    }),
  ]);
  return { items: rows.map((o) => shapeSummary(o, false)), total, page: q.page, pageSize: q.pageSize };
}

export async function listBoard() {
  const columns = await Promise.all(
    (["new", "confirmed", "ready", "delivered", "cancelled"] as const).map(async (status) => {
      const [total, rows] = await Promise.all([
        prisma.order.count({ where: { status } }),
        prisma.order.findMany({
          where: { status },
          include: summaryInclude,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 40,
        }),
      ]);
      return [status, { total, items: rows.map((o) => shapeSummary(o, true)) }] as const;
    }),
  );
  return Object.fromEntries(columns);
}

export async function listAllOrders(q: AdminListQ) {
  const where: Prisma.OrderWhereInput = {};
  if (q.status) where.status = q.status;
  if (q.userId) where.userId = q.userId;
  if (q.q) where.OR = [
    { orderNo: { contains: q.q, mode: "insensitive" } },
    { user: { fullName: { contains: q.q, mode: "insensitive" } } },
    { user: { username: { contains: q.q, mode: "insensitive" } } },
  ];
  if (q.from || q.to) {
    const range: Prisma.DateTimeFilter = {};
    if (q.from) range.gte = new Date(`${q.from}T00:00:00Z`);
    if (q.to) range.lt = new Date(new Date(`${q.to}T00:00:00Z`).getTime() + 86_400_000);
    where.createdAt = range;
  }
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where, include: summaryInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (q.page - 1) * q.pageSize, take: q.pageSize,
    }),
  ]);
  return { items: rows.map((o) => shapeSummary(o, true)), total, page: q.page, pageSize: q.pageSize };
}

// ---------------------------------------------------------------- status changes
export async function changeStatus(
  orderId: bigint, to: OrderStatus, actorId: bigint, note: string | undefined, ip: string | undefined,
  opts: { ownerOnly?: boolean; admin?: boolean } = {},
) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, ...(opts.ownerOnly ? { userId: actorId } : {}) },
      include: {
        reservations: { where: { status: "active" }, orderBy: [{ variantId: "asc" }, { id: "asc" }] },
        items: true,
        deliveries: { include: { items: true } },
        user: { select: { id: true, fullName: true, phone: true, whatsappOptInAt: true } },
      },
    });
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");

    const from = order.status as OrderStatus;
    if (!canTransition(from, to)) throw new HttpError(409, "INVALID_TRANSITION", `Cannot change status from ${from} to ${to}`);
    if (opts.admin && !((from === "new" && (to === "confirmed" || to === "cancelled")) || (from === "confirmed" && to === "ready"))) {
      throw new HttpError(403, "ADMIN_ORDER_ACTION_FORBIDDEN", "الأدمن يمكنه اعتماد الطلب أو إلغاؤه أو تجهيزه للبيع فقط");
    }
    if (opts.ownerOnly && !(from === "new" && to === "cancelled")) {
      throw new HttpError(409, "CANCEL_NOT_ALLOWED", "An order can only be cancelled before it is confirmed");
    }

    // Compare-and-set: only one concurrent status change can win
    const claimed = await tx.order.updateMany({ where: { id: orderId, status: from }, data: { status: to } });
    if (claimed.count !== 1) throw new HttpError(409, "CONFLICT", "Order was modified, reload and retry");

    // Stock side effects
    if (to === "cancelled" || to === "delivered") {
      for (const r of order.reservations) {
        if (to === "cancelled") {
          const n = await tx.$executeRaw`
            UPDATE stock_levels SET reserved = reserved - ${r.qty}
            WHERE variant_id = ${r.variantId} AND warehouse_id = ${r.warehouseId} AND reserved >= ${r.qty}`;
          if (n !== 1) throw new HttpError(500, "STOCK_INCONSISTENT", `Cannot release reservation ${r.id}`);
        } else {
          const n = await tx.$executeRaw`
            UPDATE stock_levels SET on_hand = on_hand - ${r.qty}, reserved = reserved - ${r.qty}
            WHERE variant_id = ${r.variantId} AND warehouse_id = ${r.warehouseId}
              AND reserved >= ${r.qty} AND on_hand >= ${r.qty}`;
          if (n !== 1) throw new HttpError(500, "STOCK_INCONSISTENT", `Cannot ship reservation ${r.id}`);
        }
      }
      if (order.reservations.length) {
        await tx.stockMovement.createMany({
          data: order.reservations.map((r) => ({
            variantId: r.variantId, warehouseId: r.warehouseId,
            type: to === "cancelled" ? "release" : "ship", qty: -r.qty,
            refType: "order", refId: order.id, createdBy: actorId,
          })),
        });
        await tx.reservation.updateMany({
          where: { id: { in: order.reservations.map((r) => r.id) } },
          data: { status: to === "cancelled" ? "released" : "fulfilled" },
        });
      }
      if (to === "delivered" && order.reservations.length) {
        const deliveredByItem = new Map<string, Prisma.Decimal>();
        for (const d of order.deliveries) for (const item of d.items) {
          deliveredByItem.set(item.orderItemId.toString(), (deliveredByItem.get(item.orderItemId.toString()) ?? new Prisma.Decimal(0)).add(item.amount));
        }
        await tx.delivery.create({
          data: {
            orderId: order.id, createdBy: actorId, note: "تسليم كامل للطلب",
            items: { create: order.items.filter((item) => order.reservations.some((r) => r.variantId === item.variantId)).map((item) => ({
              orderItemId: item.id,
              qty: order.reservations.find((r) => r.variantId === item.variantId)!.qty,
              amount: item.lineTotal.sub(deliveredByItem.get(item.id.toString()) ?? new Prisma.Decimal(0)),
            })) },
          },
        });
      }
    }

    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: from, toStatus: to, changedBy: actorId, note },
    });
    // Notify the other side(s). Payload carries everything the toast / WhatsApp text needs.
    const payload = toJson({
      type: "order_status", orderId, orderNo: order.orderNo, from, to,
      total: money(order.total), distributor: order.user.fullName,
    });
    const admins = (await activeAdmins(tx)).filter((a) => a.id !== actorId);
    const rows: NotifRow[] = [];
    if (order.userId !== actorId) {
      // An admin changed it → tell the distributor (in-app + WhatsApp).
      rows.push(...notifyUsers([{ id: order.user.id, phone: order.user.phone, whatsappOptInAt: order.user.whatsappOptInAt }], payload, { whatsapp: true }));
      // …and keep the other admins' boards/bells in sync (in-app only).
      rows.push(...notifyUsers(admins, payload, { whatsapp: false }));
    } else {
      // The distributor changed it (cancel) → tell the admins (in-app + WhatsApp).
      rows.push(...notifyUsers(admins, payload, { whatsapp: true }));
    }
    if (rows.length) await tx.notificationQueue.createMany({ data: rows });
    await tx.auditLog.create({
      data: {
        actorId, action: "order.status_change", entity: "order", entityId: orderId.toString(),
        meta: toJson({ from, to, note }), ip,
      },
    });
  }, TX_OPTS);

  wakeWorker();
}

// ---------------------------------------------------------------- partial / full delivery
export async function recordDelivery(orderId: bigint, input: z.output<typeof CreateDeliveryBody>, actorId: bigint, ip?: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        reservations: { where: { status: "active" } },
        deliveries: { include: { items: true } },
        user: { select: { id: true, fullName: true, phone: true, whatsappOptInAt: true } },
      },
    });
    if (!order) throw new HttpError(404, "ORDER_NOT_FOUND");
    if (order.status !== "ready") throw new HttpError(409, "ORDER_NOT_READY", "Only ready orders can be dispatched");

    const shippedQty = new Map<string, number>();
    const shippedAmount = new Map<string, Prisma.Decimal>();
    for (const delivery of order.deliveries) for (const item of delivery.items) {
      const key = item.orderItemId.toString();
      shippedQty.set(key, (shippedQty.get(key) ?? 0) + item.qty);
      shippedAmount.set(key, (shippedAmount.get(key) ?? new Prisma.Decimal(0)).add(item.amount));
    }
    const requested = new Map<string, number>();
    for (const item of input.items) {
      const key = item.orderItemId.toString();
      if (requested.has(key)) throw new HttpError(400, "DUPLICATE_DELIVERY_ITEM");
      requested.set(key, item.qty);
      const orderItem = order.items.find((line) => line.id === item.orderItemId);
      if (!orderItem) throw new HttpError(400, "INVALID_DELIVERY_ITEM");
      const left = orderItem.qty - (shippedQty.get(key) ?? 0);
      if (item.qty > left) throw new HttpError(409, "DELIVERY_QTY_EXCEEDED", `Only ${left} units remain for ${orderItem.variantLabel}`);
      const reservation = order.reservations.find((row) => row.variantId === orderItem.variantId);
      if (!reservation || item.qty > reservation.qty) throw new HttpError(409, "RESERVATION_MISSING");
    }

    const delivery = await tx.delivery.create({
      data: { orderId, trackingNumber: input.trackingNumber || null, note: input.note || null, createdBy: actorId },
    });
    for (const item of input.items) {
      const key = item.orderItemId.toString();
      const orderItem = order.items.find((line) => line.id === item.orderItemId)!;
      const reservation = order.reservations.find((row) => row.variantId === orderItem.variantId)!;
      const leftQty = orderItem.qty - (shippedQty.get(key) ?? 0);
      const leftAmount = orderItem.lineTotal.sub(shippedAmount.get(key) ?? new Prisma.Decimal(0));
      const amount = item.qty === leftQty ? leftAmount : leftAmount.mul(item.qty).div(leftQty).toDecimalPlaces(2);

      const changed = await tx.$executeRaw`
        UPDATE stock_levels SET on_hand = on_hand - ${item.qty}, reserved = reserved - ${item.qty}
        WHERE variant_id = ${reservation.variantId} AND warehouse_id = ${reservation.warehouseId}
          AND reserved >= ${item.qty} AND on_hand >= ${item.qty}`;
      if (changed !== 1) throw new HttpError(500, "STOCK_INCONSISTENT");
      await tx.reservation.update({ where: { id: reservation.id }, data: {
        qty: reservation.qty - item.qty,
        ...(reservation.qty === item.qty ? { status: "fulfilled" } : {}),
      } });
      await tx.stockMovement.create({ data: {
        variantId: reservation.variantId, warehouseId: reservation.warehouseId, type: "ship", qty: -item.qty,
        refType: "delivery", refId: delivery.id, createdBy: actorId,
      } });
      await tx.deliveryItem.create({ data: { deliveryId: delivery.id, orderItemId: item.orderItemId, qty: item.qty, amount } });
    }

    const complete = order.items.every((item) => (shippedQty.get(item.id.toString()) ?? 0) + (requested.get(item.id.toString()) ?? 0) >= item.qty);
    if (complete) {
      const changed = await tx.order.updateMany({ where: { id: orderId, status: "ready" }, data: { status: "delivered" } });
      if (changed.count !== 1) throw new HttpError(409, "CONFLICT");
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: "ready", toStatus: "delivered", changedBy: actorId, note: input.note || "اكتمل تسليم الطلب" } });
      const admins = (await activeAdmins(tx)).filter((admin) => admin.id !== actorId);
      const payload = toJson({ type: "order_status", orderId, orderNo: order.orderNo, from: "ready", to: "delivered", total: money(order.total), distributor: order.user.fullName });
      const rows = order.userId !== actorId
        ? [...notifyUsers([{ id: order.user.id, phone: order.user.phone, whatsappOptInAt: order.user.whatsappOptInAt }], payload, { whatsapp: true }), ...notifyUsers(admins, payload, { whatsapp: false })]
        : notifyUsers(admins, payload, { whatsapp: true });
      if (rows.length) await tx.notificationQueue.createMany({ data: rows });
    }
    await tx.auditLog.create({ data: {
      actorId, action: "order.delivery", entity: "delivery", entityId: delivery.id.toString(),
      meta: toJson({ orderId, complete, items: input.items.map((item) => ({ orderItemId: item.orderItemId, qty: item.qty })) }), ip,
    } });
  }, TX_OPTS);
  wakeWorker();
  return getOrder(orderId, { admin: true });
}

export async function cancelOwnOrder(orderId: bigint, userId: bigint, ip?: string) {
  await changeStatus(orderId, "cancelled", userId, undefined, ip, { ownerOnly: true });
  return getOrder(orderId, { ownerId: userId });
}

export async function adminChangeStatus(orderId: bigint, to: OrderStatus, adminId: bigint, note: string | undefined, ip?: string, role: "admin" | "super_admin" = "admin") {
  await changeStatus(orderId, to, adminId, note, ip, { admin: role === "admin" });
  return getOrder(orderId, { admin: true });
}
