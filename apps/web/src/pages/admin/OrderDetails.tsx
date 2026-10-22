import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Printer } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ORDER_TRANSITIONS, type OrderStatus } from "@do/shared";
import OrderTimeline from "../../components/OrderTimeline";
import { ErrorBox, Skeleton, Spinner, StatusBadge } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { dateTime, money } from "../../lib/format";
import { STATUS_LABEL } from "../../lib/status";
import { useUI } from "../../store/ui";
import type { OrderDetail } from "../../lib/types";
import PrintHeader from "../../components/PrintHeader";

export default function AdminOrderDetails() {
  const { id = "" } = useParams();
  const [note, setNote] = useState("");
  const push = useUI((s) => s.push);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-order", id], queryFn: () => api.get<OrderDetail>(`/admin/orders/${id}`) });

  const change = useMutation({
    mutationFn: (status: OrderStatus) => api.patch<OrderDetail>(`/admin/orders/${id}/status`, { status, note: note || undefined }),
    onSuccess: () => {
      push("تم تحديث حالة الطلب", "ok");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-board"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (e) => push(errorText(e), "err"),
  });

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (q.isError || !q.data) return <ErrorBox text={errorText(q.error)} onRetry={() => q.refetch()} />;
  const o = q.data;
  const next = ORDER_TRANSITIONS[o.status];

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight className="h-4 w-4" /> الطلبات</Link>
        <button className="btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</button>
      </div>
      <PrintHeader />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold" dir="ltr">{o.orderNo}</h1>
          <p className="text-sm text-muted">{dateTime(o.createdAt)} · {o.warehouse.name}</p>
          {o.user && <p className="text-sm">الموزع: {o.user.fullName} <span dir="ltr" className="text-muted">({o.user.username}{o.user.phone ? ` · ${o.user.phone}` : ""})</span></p>}
        </div>
        <StatusBadge status={o.status} />
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-3">
          <ul className="space-y-3">
            {o.items.map((i) => (
              <li key={i.id} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{i.productName}</p>
                  <p className="text-sm text-muted">{i.variantLabel} · {i.qty} × {money(i.unitPrice)}{Number(i.discountPct) > 0 && ` · خصم ${Number(i.discountPct)}%`}</p>
                </div>
                <p className="font-display font-bold text-primary">{money(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="card space-y-2 p-4 text-sm">
            <div className="flex justify-between text-muted"><dt>قبل الخصم</dt><dd>{money(o.subtotal)}</dd></div>
            {Number(o.discountTotal) > 0 && <div className="flex justify-between text-success"><dt>الخصم</dt><dd>- {money(o.discountTotal)}</dd></div>}
            <div className="flex justify-between font-display text-xl font-bold"><dt>الإجمالي</dt><dd className="text-primary">{money(o.total)}</dd></div>
          </dl>
          {o.notes && <p className="card p-4 text-sm text-muted">ملاحظات الموزع: {o.notes}</p>}
        </section>
        <aside className="space-y-4 print:hidden">
          <div className="card space-y-4 p-5">
            <h2 className="font-display text-lg font-bold">الحالة</h2>
            <OrderTimeline order={o} />
            {next.length > 0 && (
              <div className="space-y-3 border-t border-line/10 pt-4">
                <label className="label">ملاحظة (اختياري)
                  <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
                </label>
                <div className="flex flex-col gap-2">
                  {next.map((s) => (
                    <button key={s} className={s === "cancelled" ? "btn-danger" : "btn-primary"} disabled={change.isPending}
                      onClick={() => { if (s === "cancelled" && !window.confirm("تأكيد إلغاء الطلب؟")) return; change.mutate(s); }}>
                      {change.isPending ? <Spinner /> : STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
