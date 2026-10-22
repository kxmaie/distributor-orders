import { motion } from "framer-motion";
import {
  AlertCircle,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Printer,
  Shield,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { ErrorBox, Skeleton, StatusBadge } from "../../components/ui";
import { useAdminOrderDetail, useUpdateOrderStatus } from "../../hooks/adminQueries";
import { formatCurrency, formatDate } from "../../lib/format";
import { STATUS_LABEL } from "../../lib/status";
import { useUI } from "../../store/ui";
import type { OrderStatus } from "@do/shared";
import { ORDER_TRANSITIONS } from "@do/shared";
import PrintHeader from "../../components/PrintHeader";

type Props = {
  orderId: string | null;
  onClose: () => void;
};

export default function OrderDetailModal({ orderId, onClose }: Props) {
  const { data: order, isLoading, error } = useAdminOrderDetail(orderId);
  const updateStatus = useUpdateOrderStatus();
  const push = useUI((s) => s.push);

  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [note, setNote] = useState<string>("");

  if (!orderId) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleStatusChange = async () => {
    if (!selectedStatus) return;
    try {
      await updateStatus.mutateAsync({
        id: orderId,
        status: selectedStatus,
        note: note.trim() || undefined,
      });
      push("تم تحديث حالة الطلب بنجاح", "success");
      setSelectedStatus("");
      setNote("");
    } catch {
      push("فشل تحديث حالة الطلب", "danger");
    }
  };

  const allowedTransitions = order ? (ORDER_TRANSITIONS[order.status as OrderStatus] || []) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto print:static print:block print:bg-transparent print:p-0 print:backdrop-blur-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="card w-full max-w-3xl max-h-[90vh] flex flex-col bg-surface overflow-hidden shadow-2xl my-auto print:m-0 print:max-h-none print:shadow-none print:border-none print:bg-white print:text-black"
      >
        <div className="hidden px-4 pt-4 print:block"><PrintHeader /></div>
        {/* Header */}
        <div className="p-4 border-b border-line/10 flex items-center justify-between bg-surface2/50 print:bg-transparent">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-primary print:text-black">
              {order?.orderNo ?? "تفاصيل الطلب"}
            </span>
            {order && <StatusBadge status={order.status} />}
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="btn-ghost text-xs px-3 py-1.5 h-8 flex items-center gap-1.5"
              title="طباعة الفاتورة"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg grid place-items-center text-muted hover:text-ink hover:bg-line/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-40" />
            </div>
          )}

          {error && <ErrorBox text="فشل تحميل تفاصيل الطلب" />}

          {order && (
            <>
              {/* Distributor & Warehouse Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl border border-line/10 bg-surface2/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-muted font-semibold">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span>بيانات الموزع</span>
                  </div>
                  <div className="font-bold text-sm text-ink">{order.user?.fullName}</div>
                  <div className="text-muted">
                    <span>@{order.user?.username}</span>
                    {order.user?.phone && <span> · {order.user.phone}</span>}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-line/10 bg-surface2/30 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-muted font-semibold">
                    <Building className="h-3.5 w-3.5 text-accent" />
                    <span>المخزن وتاريخ الطلب</span>
                  </div>
                  <div className="font-bold text-sm text-ink">{order.warehouse.name}</div>
                  <div className="text-muted flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Order Notes (if any) */}
              {order.notes && (
                <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 text-xs">
                  <span className="font-bold text-primary">ملاحظات العميل: </span>
                  <span className="text-ink">{order.notes}</span>
                </div>
              )}

              {/* Order Items Table */}
              <div>
                <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>بنود الطلب</span>
                </h3>
                <div className="border border-line/10 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-surface2/50 text-muted border-b border-line/10">
                      <tr>
                        <th className="p-3 text-start">المنتج / المقاس</th>
                        <th className="p-3 text-center">السعر</th>
                        <th className="p-3 text-center">الخصم</th>
                        <th className="p-3 text-center">الكمية</th>
                        <th className="p-3 text-end">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/10">
                      {order.items.map((it) => (
                        <tr key={it.id}>
                          <td className="p-3">
                            <div className="font-bold text-ink">{it.productName}</div>
                            <div className="text-[11px] text-muted">{it.variantLabel}</div>
                          </td>
                          <td className="p-3 text-center font-mono">{formatCurrency(it.unitPrice)}</td>
                          <td className="p-3 text-center text-accent">
                            {Number(it.discountPct) > 0 ? `${it.discountPct}%` : "—"}
                          </td>
                          <td className="p-3 text-center font-bold">{it.qty}</td>
                          <td className="p-3 text-end font-bold text-primary">{formatCurrency(it.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Summary */}
                <div className="mt-4 flex justify-end">
                  <div className="w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-muted">
                      <span>المجموع الفرعي:</span>
                      <span className="font-mono">{formatCurrency(order.subtotal)}</span>
                    </div>
                    {Number(order.discountTotal) > 0 && (
                      <div className="flex justify-between text-accent">
                        <span>إجمالي الخصم:</span>
                        <span className="font-mono">- {formatCurrency(order.discountTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm pt-2 border-t border-line/10 text-primary">
                      <span>الإجمالي النهائي:</span>
                      <span>{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Update Action Box (Hidden in Print) */}
              {allowedTransitions.length > 0 && (
                <div className="p-4 rounded-xl border border-line/15 bg-surface2/40 space-y-3 print:hidden">
                  <div className="text-xs font-bold text-ink flex items-center gap-1.5">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>تحديث حالة الطلب</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-muted block mb-1">الحالة الجديدة:</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="input text-xs"
                      >
                        <option value="">اختر الحالة الجديدة...</option>
                        {allowedTransitions.map((st) => (
                          <option key={st} value={st}>
                            {STATUS_LABEL[st as OrderStatus]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted block mb-1">ملاحظة داخلية (اختياري):</label>
                      <input
                        type="text"
                        placeholder="سبب التغيير أو تفاصيل..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="input text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleStatusChange}
                      disabled={!selectedStatus || updateStatus.isPending}
                      className="btn-primary text-xs px-4 py-2"
                    >
                      {updateStatus.isPending ? "جارٍ الحفظ..." : "حفظ التغيير"}
                    </button>
                  </div>
                </div>
              )}

              {/* Audit History Timeline */}
              <div className="print:hidden">
                <h3 className="text-xs font-bold text-muted mb-3 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>سجل تغييرات الحالة والتدقيق</span>
                </h3>
                <div className="space-y-3 relative before:absolute before:inset-y-0 before:start-2.5 before:w-0.5 before:bg-line/10 ps-6">
                  {order.history.map((h, i) => (
                    <div key={i} className="relative text-xs">
                      <span className="absolute -start-6 top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-bg" />
                      <div className="font-semibold text-ink">
                        <span>تم تحويل الحالة إلى </span>
                        <span className="text-primary">{STATUS_LABEL[h.toStatus]}</span>
                        {h.fromStatus && (
                          <span className="text-muted text-[11px]"> (من {STATUS_LABEL[h.fromStatus as OrderStatus]})</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        <span>{formatDate(h.createdAt)}</span>
                        {h.note && <span className="ms-2 italic text-ink/80">"{h.note}"</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
