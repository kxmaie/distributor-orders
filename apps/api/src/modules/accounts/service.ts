import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { AccountQuery, CreatePaymentBody } from "@do/shared";
import { prisma } from "../../lib/db";
import { HttpError } from "../../lib/errors";
import { toJson } from "../../lib/json";

type PaymentInput = z.output<typeof CreatePaymentBody>;
type StatementInput = z.output<typeof AccountQuery>;
const money = (value: Prisma.Decimal) => value.toFixed(2);
const dateEdge = (value: string, end = false) => new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);

export async function getStatement(userId: bigint, range: StatementInput = {}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, username: true } });
  if (!user) throw new HttpError(404, "USER_NOT_FOUND");

  const [deliveries, payments] = await Promise.all([
    prisma.delivery.findMany({
      where: { order: { userId } },
      include: { order: { select: { orderNo: true } }, items: { select: { amount: true, qty: true } } },
      orderBy: { deliveredAt: "asc" },
    }),
    prisma.payment.findMany({ where: { userId }, orderBy: { receivedAt: "asc" } }),
  ]);

  const entries = [
    ...deliveries.map((delivery) => ({
      id: `delivery-${delivery.id}`, date: delivery.deliveredAt.toISOString(), type: "delivery" as const,
      reference: delivery.order.orderNo, description: delivery.note || `تسليم طلب ${delivery.order.orderNo}`,
      debit: delivery.items.reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0)), credit: new Prisma.Decimal(0),
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`, date: payment.receivedAt.toISOString(), type: "payment" as const,
      reference: payment.reference || "", description: payment.note || `دفعة (${payment.method})`,
      debit: new Prisma.Decimal(0), credit: payment.amount,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const from = range.from ? dateEdge(range.from) : undefined;
  const to = range.to ? dateEdge(range.to, true) : undefined;
  let balance = new Prisma.Decimal(0);
  let openingBalance = new Prisma.Decimal(0);
  const visible = [] as typeof entries;
  for (const entry of entries) {
    balance = balance.add(entry.debit).sub(entry.credit);
    if (from && new Date(entry.date) < from) openingBalance = openingBalance.add(entry.debit).sub(entry.credit);
    if ((!from || new Date(entry.date) >= from) && (!to || new Date(entry.date) <= to)) visible.push(entry);
  }

  let running = new Prisma.Decimal(openingBalance);
  const rows = visible.map((entry) => {
    running = running.add(entry.debit).sub(entry.credit);
    return { id: entry.id, date: entry.date, type: entry.type, reference: entry.reference, description: entry.description,
      debit: money(entry.debit), credit: money(entry.credit), balance: money(running) };
  });
  return { user, openingBalance: money(openingBalance), balance: money(balance), rows };
}

export async function listAccounts() {
  const users = await prisma.user.findMany({ where: { role: "distributor" }, select: { id: true, username: true, fullName: true, phone: true, isActive: true }, orderBy: { fullName: "asc" } });
  return Promise.all(users.map(async (user) => {
    const [delivered, paid] = await Promise.all([
      prisma.deliveryItem.aggregate({ where: { delivery: { order: { userId: user.id } } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
    ]);
    const due = (delivered._sum.amount ?? new Prisma.Decimal(0)).sub(paid._sum.amount ?? new Prisma.Decimal(0));
    return { ...user, id: user.id.toString(), balance: money(due) };
  }));
}

export async function recordPayment(userId: bigint, actorId: bigint, input: PaymentInput, ip?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user || user.role !== "distributor") throw new HttpError(404, "USER_NOT_FOUND");
  const amount = new Prisma.Decimal(input.amount);
  const payment = await prisma.$transaction(async (tx) => {
    const row = await tx.payment.create({
      data: { userId, amount, method: input.method, reference: input.reference || null, note: input.note || null, createdBy: actorId },
    });
    await tx.auditLog.create({
      data: { actorId, action: "account.payment", entity: "payment", entityId: row.id.toString(), meta: toJson({ userId, amount: money(amount), method: input.method }), ip },
    });
    return row;
  });
  return { ...payment, id: payment.id.toString(), userId: payment.userId.toString(), amount: money(payment.amount) };
}
