import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  KeyRound,
  Package,
  Plus,
  ShoppingBag,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorBox, Skeleton, StatusBadge } from "../../components/ui";
import { useAdminDashboard } from "../../hooks/adminQueries";
import { formatCurrency, formatDate } from "../../lib/format";
import type { OrderStatus } from "@do/shared";

export default function AdminDashboard() {
  const { data, isLoading, error, refetch } = useAdminDashboard();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorBox text="فشل تحميل بيانات لوحة المؤشرات" onRetry={() => refetch()} />;
  }

  const { stats, salesTrend, statusCounts, topProducts, topDistributors, recentOrders } = data;

  // Max value for sales trend SVG chart
  const maxRevenue = Math.max(...salesTrend.map((t) => Number(t.revenue) || 0), 100);

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold">لوحة المؤشرات</h1>
          <p className="text-sm text-muted">نظرة عامة على نشاط المنصة، المبيعات، والطلبات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/admin/orders?status=new" className="btn-primary text-xs px-3 py-2">
            <ShoppingBag className="h-4 w-4" />
            <span>طلبات جديدة ({stats.newOrdersCount})</span>
          </Link>
          <Link to="/admin/stock" className="btn-ghost text-xs px-3 py-2">
            <Boxes className="h-4 w-4" />
            <span>تعديل مخزون</span>
          </Link>
          <Link to="/admin/users" className="btn-ghost text-xs px-3 py-2">
            <UserPlus className="h-4 w-4" />
            <span>إضافة موزع</span>
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">إجمالي المبيعات</span>
            <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary grid place-items-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2">{formatCurrency(stats.totalRevenue)}</div>
          <div className="text-xs text-muted mt-1 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-accent" />
            <span>مبيعات اليوم: <strong className="text-ink">{formatCurrency(stats.todayRevenue)}</strong></span>
          </div>
        </div>

        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">إجمالي الطلبات</span>
            <div className="h-9 w-9 rounded-xl bg-accent/15 text-accent grid place-items-center">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2">{stats.totalOrders}</div>
          <div className="text-xs text-muted mt-1 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>قيد المعالجة: <strong className="text-ink">{stats.newOrdersCount}</strong></span>
          </div>
        </div>

        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">تنبيهات المخزون</span>
            <div className={`h-9 w-9 rounded-xl grid place-items-center ${stats.lowStockVariants > 0 ? "bg-danger/15 text-danger" : "bg-success/15 text-success"}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2">{stats.lowStockVariants}</div>
          <div className="text-xs text-muted mt-1">
            {stats.lowStockVariants > 0 ? (
              <span className="text-danger font-semibold">أصناف قريبة من النفاد (&le; 5)</span>
            ) : (
              <span className="text-success">المخزون كافٍ ومستقر</span>
            )}
          </div>
        </div>

        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">استعادة كلمة المرور</span>
            <div className={`h-9 w-9 rounded-xl grid place-items-center ${stats.pendingPasswordRequests > 0 ? "bg-primary/20 text-primary" : "bg-surface2 text-muted"}`}>
              <KeyRound className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2">{stats.pendingPasswordRequests}</div>
          <div className="text-xs text-muted mt-1">
            {stats.pendingPasswordRequests > 0 ? (
              <Link to="/admin/users" className="text-primary hover:underline">
                يوجد {stats.pendingPasswordRequests} طلب بانتظار الاعتماد
              </Link>
            ) : (
              <span>لا توجد طلبات معلقة</span>
            )}
          </div>
        </div>

        {/* Pending Registrations KPI */}
        <div className="card p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">طلبات تسجيل جديدة</span>
            <div className={`h-9 w-9 rounded-xl grid place-items-center ${stats.pendingRegistrations > 0 ? "bg-primary/20 text-primary" : "bg-surface2 text-muted"}`}>
              <UserPlus className="h-5 w-5" />
            </div>
          </div>
          <div className="text-2xl font-bold mt-2">{stats.pendingRegistrations}</div>
          <div className="text-xs text-muted mt-1">
            {stats.pendingRegistrations > 0 ? (
              <Link to="/admin/users?tab=pending" className="text-primary hover:underline">
                يوجد {stats.pendingRegistrations} طلب تسجيل بانتظار المراجعة
              </Link>
            ) : (
              <span>لا توجد طلبات تسجيل معلقة</span>
            )}
          </div>
        </div>
      </div>

      {/* Sales Trend Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold">مبيعات آخر 14 يوماً</h2>
            <p className="text-xs text-muted">حجم الإيرادات اليومية وتوزيع الطلبات</p>
          </div>
          <div className="text-xs text-muted flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              <span>الإيراد اليومي</span>
            </span>
          </div>
        </div>

        {/* SVG Responsive Bar Chart */}
        <div className="h-52 w-full flex items-end gap-2 pt-6 pb-2" dir="ltr">
          {salesTrend.map((item, idx) => {
            const val = Number(item.revenue) || 0;
            const pct = Math.max(8, Math.round((val / maxRevenue) * 100));
            const dayLabel = item.date.slice(5); // MM-DD
            return (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                {/* Tooltip on hover */}
                <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-surface border border-line/20 rounded px-2 py-1 text-[11px] font-bold shadow-lg z-10 whitespace-nowrap">
                  {val.toLocaleString()} ج.م ({item.orders} طلب)
                </div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.5, delay: idx * 0.03 }}
                  className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-primary/60 to-primary transition hover:brightness-125"
                />
                <span className="text-[10px] text-muted mt-2 rotate-45 sm:rotate-0 origin-left truncate">
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Orders Status Grid & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Orders */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold">أحدث الطلبات</h2>
            <Link to="/admin/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
              <span>عرض جميع الطلبات</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-line/10">
            {recentOrders.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted">لا توجد طلبات حتى الآن</div>
            ) : (
              recentOrders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => navigate(`/admin/orders?orderId=${ord.id}`)}
                  className="py-3 flex items-center justify-between gap-3 hover:bg-line/5 rounded-xl px-2 cursor-pointer transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-ink">{ord.orderNo}</span>
                      <StatusBadge status={ord.status as OrderStatus} />
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      <span>{ord.customerName}</span> · <span>{formatDate(ord.createdAt)}</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="font-bold text-sm text-primary">{formatCurrency(ord.total)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Status breakdown & Top Sellers */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-base font-bold mb-3">حالات الطلبات</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-line/10">
                <span className="text-muted">طلبات جديدة</span>
                <span className="font-bold text-ink">{statusCounts.new || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/10">
                <span className="text-muted">مؤكدة</span>
                <span className="font-bold text-ink">{statusCounts.confirmed || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/10">
                <span className="text-muted">جاهزة للتسليم</span>
                <span className="font-bold text-ink">{statusCounts.ready || 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/10">
                <span className="text-muted">تم التسليم</span>
                <span className="font-bold text-success">{statusCounts.delivered || 0}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted">ملغاة</span>
                <span className="font-bold text-danger">{statusCounts.cancelled || 0}</span>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-base font-bold mb-3">الأكثر طلباً</h2>
            <div className="space-y-3">
              {topProducts.length === 0 ? (
                <div className="text-xs text-muted text-center py-4">لا توجد بيانات كافية</div>
              ) : (
                topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="truncate max-w-[160px]">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-muted text-[10px]">{p.qty} قطعة</div>
                    </div>
                    <span className="font-bold text-primary">{formatCurrency(p.totalRevenue)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
