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
    prisma.user.count({ where: { isActive: false, role: "distributor" } }),
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
    in_production: 0,
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
      id: d.id,
      fullName: d.fullName,
      username: d.username,
      orderCount: d.orderCount,
      totalSpend: money(d.totalSpend),
    }));

  // Sales Trend for last 14 days
  const trendMap = new Map<string, { revenue: Prisma.Decimal; orders: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    trendMap.set(key, { revenue: new Prisma.Decimal(0), orders: 0 });
  }
  for (const o of recentOrdersForTrend) {
    const key = o.createdAt.toISOString().slice(0, 10);
    if (trendMap.has(key)) {
      const e = trendMap.get(key)!;
      e.revenue = e.revenue.add(o.total);
      e.orders += 1;
    }
  }
  const salesTrend = Array.from(trendMap.entries()).map(([date, data]) => ({
    date,
    revenue: money(data.revenue),
    orders: data.orders,
  }));

  // Top products
  const orderItems = await prisma.orderItem.findMany({
    where: { order: { status: { not: "cancelled" } } },
    select: { variantId: true, productName: true, qty: true, lineTotal: true },
    take: 500,
  });

  const productMap = new Map<string, { id: string; name: string; qty: number; totalRevenue: Prisma.Decimal }>();
  for (const it of orderItems) {
    const key = it.productName;
    const curr = productMap.get(key) || {
      id: it.variantId.toString(),
      name: it.productName,
      qty: 0,
      totalRevenue: new Prisma.Decimal(0),
    };
    curr.qty += it.qty;
    curr.totalRevenue = curr.totalRevenue.add(it.lineTotal);
    productMap.set(key, curr);
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: p.name,
      qty: p.qty,
      totalRevenue: money(p.totalRevenue),
    }));

  return {
    stats: {
      totalRevenue: money(totalRev),
      todayRevenue: money(todayRev),
      monthRevenue: money(monthRev),
      totalOrders,
      newOrdersCount,
      pendingPasswordRequests,
      pendingRegistrations,
      lowStockVariants,
    },
    salesTrend,
    statusCounts,
    topProducts,
    topDistributors,
    recentOrders: recentOrdersData.map((o) => ({
      id: o.id.toString(),
      orderNo: o.orderNo,
      customerName: o.user.fullName,
      status: o.status,
      total: money(o.total),
      createdAt: o.createdAt.toISOString(),
    })),
  };
}

export async function getSalesReport(query: SalesReportQuery) {
  const where: Prisma.OrderWhereInput = {};
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) {
      where.createdAt.gte = new Date(`${query.from}T00:00:00.000Z`);
    }
    if (query.to) {
      where.createdAt.lte = new Date(`${query.to}T23:59:59.999Z`);
    }
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { fullName: true, username: true } },
      warehouse: { select: { name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let totalSales = new Prisma.Decimal(0);
  let validOrderCount = 0;
  const statusCounts: Record<string, number> = {};

  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    if (o.status !== "cancelled") {
      totalSales = totalSales.add(o.total);
      validOrderCount += 1;
    }
  }

  const avgOrderValue = validOrderCount > 0 ? totalSales.dividedBy(validOrderCount) : new Prisma.Decimal(0);

  return {
    summary: {
      totalRevenue: money(totalSales),
      totalOrders: orders.length,
      completedOrders: validOrderCount,
      averageOrderValue: money(avgOrderValue),
    },
    statusCounts,
    orders: orders.map((o) => ({
      id: o.id.toString(),
      orderNo: o.orderNo,
      customerName: o.user.fullName,
      warehouseName: o.warehouse.name,
      status: o.status,
      itemsCount: o.items.length,
      subtotal: money(o.subtotal),
      discountTotal: money(o.discountTotal),
      total: money(o.total),
      createdAt: o.createdAt.toISOString(),
    })),
  };
}
