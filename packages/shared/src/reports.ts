import { z } from "zod";

const dayRegex = /^\d{4}-\d{2}-\d{2}$/;

export const SalesReportQuery = z.object({
  from: z.string().regex(dayRegex, "use YYYY-MM-DD").optional(),
  to: z.string().regex(dayRegex, "use YYYY-MM-DD").optional(),
});
export type SalesReportQuery = z.infer<typeof SalesReportQuery>;

export type DashboardSummary = {
  stats: {
    totalRevenue: string;
    todayRevenue: string;
    monthRevenue: string;
    totalOrders: number;
    newOrdersCount: number;
    pendingPasswordRequests: number;
    pendingRegistrations: number;
    lowStockVariants: number;
  };
  salesTrend: {
    date: string;
    revenue: string;
    orders: number;
  }[];
  statusCounts: Record<string, number>;
  topProducts: {
    id: string;
    name: string;
    qty: number;
    totalRevenue: string;
  }[];
  topDistributors: {
    id: string;
    fullName: string;
    username: string;
    orderCount: number;
    totalSpend: string;
  }[];
  recentOrders: {
    id: string;
    orderNo: string;
    customerName: string;
    status: string;
    total: string;
    createdAt: string;
  }[];
};
