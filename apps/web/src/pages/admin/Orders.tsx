import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Clock,
  Eye,
  Filter,
  Kanban,
  RotateCcw,
  Search,
  Table as TableIcon,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyState, ErrorBox, Skeleton, StatusBadge } from "../../components/ui";
import { useAdminOrders, useUpdateOrderStatus } from "../../hooks/adminQueries";
import { formatCurrency, formatDate } from "../../lib/format";
import { STATUS_LABEL } from "../../lib/status";
import { useUI } from "../../store/ui";
import OrderDetailModal from "./OrderDetailModal";
import type { OrderStatus } from "@do/shared";
import { ORDER_TRANSITIONS } from "@do/shared";

const STATUSES: { value: string; label: string }[] = [
  { value: "all", label: "الكل" },
  { value: "new", label: "جديد" },
  { value: "confirmed", label: "مؤكد" },
  { value: "in_production", label: "قيد التصنيع" },
  { value: "ready", label: "جاهز للتسليم" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "ملغي" },
];

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const push = useUI((s) => s.push);
  const updateStatus = useUpdateOrderStatus();

  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    searchParams.get("orderId") || null
  );

  const [status, setStatus] = useState<string>(searchParams.get("status") || "all");
  const [search, setSearch] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  const { data, isLoading, error, refetch } = useAdminOrders({
    status: status === "all" ? undefined : status,
    q: search.trim() || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    pageSize: viewMode === "kanban" ? 50 : 15,
  });

  const handleQuickAdvance = async (orderId: string, currentStatus: OrderStatus) => {
    const nextList = ORDER_TRANSITIONS[currentStatus];
    if (!nextList || nextList.length === 0) return;
    const nextStatus = nextList[0]; // first valid transition
    try {
      await updateStatus.mutateAsync({ id: orderId, status: nextStatus });
      push(`تم نقل الطلب إلى: ${STATUS_LABEL[nextStatus]}`, "success");
    } catch {
      push("فشل تغيير حالة الطلب", "danger");
    }
  };

  const handleQuickCancel = async (orderId: string) => {
    if (!confirm("هل أنت متأكد من إلغاء هذا الطلب؟")) return;
    try {
      await updateStatus.mutateAsync({ id: orderId, status: "cancelled", note: "إلغاء سريع من الإدارة" });
      push("تم إلغاء الطلب واسترجاع حجز المخزون", "info");
    } catch {
      push("فشل إلغاء الطلب", "danger");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold">إدارة الطلبات</h1>
          <p className="text-sm text-muted">متابعة الطلبات، تغيير الحالات، وعرض أوامر التوريد</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center p-1 bg-surface2/60 border border-line/10 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === "table" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              <TableIcon className="h-4 w-4" />
              <span>جدول</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                viewMode === "kanban" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              <Kanban className="h-4 w-4" />
              <span>كانبان</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUSES.map((st) => (
            <button
              key={st.value}
              onClick={() => {
                setStatus(st.value);
                setPage(1);
              }}
              className={`chip text-xs ${status === st.value ? "chip-active" : ""}`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="relative">
            <Search className="absolute start-3 top-3 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="بحث برقم الطلب أو الموزع..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input ps-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted shrink-0">من:</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="input text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted shrink-0">إلى:</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="input text-xs"
            />
          </div>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {error && <ErrorBox text="فشل تحميل قائمة الطلبات" onRetry={() => refetch()} />}

      {/* Content Area */}
      {!isLoading && !error && data && (
        <>
          {data.items.length === 0 ? (
            <EmptyState title="لا توجد طلبات مطابقة" hint="جرب تغيير خيارات البحث أو تصفية الحالة" />
          ) : viewMode === "table" ? (
            /* =================== TABLE VIEW =================== */
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-surface2/60 text-muted border-b border-line/10">
                    <tr>
                      <th className="p-3.5 text-start font-semibold">رقم الطلب</th>
                      <th className="p-3.5 text-start font-semibold">الموزع</th>
                      <th className="p-3.5 text-start font-semibold">المخزن</th>
                      <th className="p-3.5 text-center font-semibold">الأصناف</th>
                      <th className="p-3.5 text-center font-semibold">الإجمالي</th>
                      <th className="p-3.5 text-center font-semibold">الحالة</th>
                      <th className="p-3.5 text-center font-semibold">التاريخ</th>
                      <th className="p-3.5 text-end font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/10">
                    {data.items.map((order) => {
                      const nextTransitions = ORDER_TRANSITIONS[order.status] || [];
                      const nextStatus = nextTransitions[0];
                      return (
                        <tr key={order.id} className="hover:bg-line/5 transition">
                          <td className="p-3.5 font-mono font-bold text-ink">
                            <button
                              onClick={() => setSelectedOrderId(order.id)}
                              className="text-primary hover:underline"
                            >
                              {order.orderNo}
                            </button>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-ink">{order.user?.fullName ?? "—"}</div>
                            <div className="text-[11px] text-muted">@{order.user?.username}</div>
                          </td>
                          <td className="p-3.5 text-muted">{order.warehouse.name}</td>
                          <td className="p-3.5 text-center font-bold">{order.itemCount}</td>
                          <td className="p-3.5 text-center font-bold text-primary font-mono">
                            {formatCurrency(order.total)}
                          </td>
                          <td className="p-3.5 text-center">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="p-3.5 text-center text-muted">{formatDate(order.createdAt)}</td>
                          <td className="p-3.5 text-end">
                            <div className="inline-flex items-center gap-1.5">
                              {nextStatus && (
                                <button
                                  onClick={() => handleQuickAdvance(order.id, order.status)}
                                  className="btn-ghost text-[11px] px-2.5 py-1 h-7 text-accent border-accent/20 hover:bg-accent/10"
                                  title={`نقل إلى ${STATUS_LABEL[nextStatus]}`}
                                >
                                  <span>{STATUS_LABEL[nextStatus]}</span>
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedOrderId(order.id)}
                                className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-ink"
                                title="عرض التفاصيل"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-3 border-t border-line/10 flex items-center justify-between text-xs text-muted">
                <span>
                  إجمالي النتائج: <strong className="text-ink">{data.total}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-ghost text-xs px-3 py-1 h-8 disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <span className="font-semibold text-ink">
                    صفحة {page} من {Math.ceil(data.total / data.pageSize) || 1}
                  </span>
                  <button
                    disabled={page * data.pageSize >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-ghost text-xs px-3 py-1 h-8 disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* =================== KANBAN BOARD VIEW =================== */
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
              {(["new", "confirmed", "in_production", "ready", "delivered", "cancelled"] as OrderStatus[]).map(
                (colStatus) => {
                  const colOrders = data.items.filter((o) => o.status === colStatus);
                  const nextTransitions = ORDER_TRANSITIONS[colStatus] || [];
                  const nextStatus = nextTransitions[0];

                  return (
                    <div
                      key={colStatus}
                      className="card p-3 flex flex-col bg-surface2/30 border border-line/10 min-w-[220px]"
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-line/10">
                        <span className="font-bold text-xs">{STATUS_LABEL[colStatus]}</span>
                        <span className="px-2 py-0.5 rounded-full bg-surface2 text-[11px] font-bold text-muted">
                          {colOrders.length}
                        </span>
                      </div>

                      {/* Orders Cards */}
                      <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[65vh]">
                        {colOrders.length === 0 ? (
                          <div className="text-[11px] text-muted text-center py-6">لا توجد طلبات</div>
                        ) : (
                          colOrders.map((ord) => (
                            <div
                              key={ord.id}
                              className="p-3 rounded-xl bg-surface border border-line/10 hover:border-primary/40 transition shadow-sm space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  onClick={() => setSelectedOrderId(ord.id)}
                                  className="font-mono font-bold text-xs text-primary cursor-pointer hover:underline"
                                >
                                  {ord.orderNo}
                                </span>
                                <span className="text-[10px] text-muted">{formatDate(ord.createdAt)}</span>
                              </div>

                              <div className="text-xs font-semibold text-ink truncate">
                                {ord.user?.fullName}
                              </div>

                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-line/5">
                                <span className="text-muted">{ord.itemCount} قطع</span>
                                <span className="font-bold text-primary font-mono">
                                  {formatCurrency(ord.total)}
                                </span>
                              </div>

                              {/* Card Actions */}
                              <div className="flex items-center justify-between pt-1 gap-1">
                                <button
                                  onClick={() => setSelectedOrderId(ord.id)}
                                  className="text-[10px] text-muted hover:text-ink flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>تفاصيل</span>
                                </button>

                                {nextStatus && (
                                  <button
                                    onClick={() => handleQuickAdvance(ord.id, ord.status)}
                                    className="btn-ghost text-[10px] px-2 py-0.5 h-6 text-accent border-accent/20 hover:bg-accent/10"
                                  >
                                    <span>{STATUS_LABEL[nextStatus]}</span>
                                    <ArrowRight className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </>
      )}

      {/* Order Detail & Printable Modal */}
      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
}
