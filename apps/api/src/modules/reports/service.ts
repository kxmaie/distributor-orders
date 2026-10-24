import { Prisma } from "@prisma/client";
import type { DashboardSummary, SalesReportQuery } from "@do/shared";
import { prisma } from "../../lib/db";

const money = (d: Prisma.Decimal | number | string) => {
  const dec = typeof d === "object" && "toFixed" in d ? d : new Prisma.Decimal(d || 0);
  return dec.toFixed(2);
};

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000);

  // 1. Basic counts and metrics in parallel
  const [
    totalOrders,
    newOrdersCount,
    pendingPasswordRequests,
    pendingRegistrations,
    statusGroupCounts,
    recentOrdersData,
    stockLevels,
    recentOrdersForTrend,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "new" } }),
    prisma.passwordRequest.count({ where: { status: "pending" } }),
    prisma.user.count({ where: { isActive: false, registrationRejectedAt: null, role: { in: ["distributor", "supplier"] } } }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.order.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true } } },
    }),
    prisma.stockLevel.findMany({
      where: { warehouse: { isActive: true }, variant: { isActive: true } },
      select: { onHand: true, reserved: true },
    }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: fourteenDaysAgo },
        status: { not: "cancelled" },
      },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Low stock count
  const lowStockVariants = stockLevels.filter((s) => s.onHand - s.reserved <= 5).length;

  // Status counts map
  const statusCounts: Record<string, number> = {
    new: 0,
    confirmed: 0,
    ready: 0,
    delivered: 0,
    cancelled: 0,
  };
  for (const g of statusGroupCounts) {
    statusCounts[g.status] = g._count._all;
  }

  // Revenues (total, today, month)
  const nonCancelled = await prisma.order.findMany({
    where: { status: { not: "cancelled" } },
    select: { createdAt: true, total: true, userId: true, user: { select: { fullName: true, username: true } } },
  });

  let totalRev = new Prisma.Decimal(0);
  let todayRev = new Prisma.Decimal(0);
  let monthRev = new Prisma.Decimal(0);

  // Top distributors calculation
  const distributorMap = new Map<string, { id: string; fullName: string; username: string; orderCount: number; totalSpend: Prisma.Decimal }>();

  for (const o of nonCancelled) {
    totalRev = totalRev.add(o.total);
    if (o.createdAt >= startOfToday) {
      todayRev = todayRev.add(o.total);
    }
    if (o.createdAt >= startOfMonth) {
      monthRev = monthRev.add(o.total);
    }

    const uKey = o.userId.toString();
    const curr = distributorMap.get(uKey) || {
      id: uKey,
      fullName: o.user.fullName,
      username: o.user.username,
      orderCount: 0,
      totalSpend: new Prisma.Decimal(0),
    };
    curr.orderCount += 1;
    curr.totalSpend = curr.totalSpend.add(o.total);
    distributorMap.set(uKey, curr);
  }

  const topDistributors = Array.from(distributorMap.values())
    .sort((a, b) => (b.totalSpend.greaterThan(a.totalSpend) ? 1 : -1))
    .slice(0, 5)
    .map((d) => ({
      