import { z } from "zod";
export declare const SalesReportQuery: z.ZodObject<{
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    from?: string | undefined;
    to?: string | undefined;
}, {
    from?: string | undefined;
    to?: string | undefined;
}>;
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
