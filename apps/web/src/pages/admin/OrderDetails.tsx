import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Printer, Truck } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [trackingNumber, setTrackingNumber] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliverQty, setDeliverQty] = useState<Record<string, number>>({});
  const push = useUI((s) => s.push);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-order", id], queryFn: () => api.get<OrderDetail>(`/admin/orders/${id}`) });
  useEffect(() => {
    if (!q.data) return;
    const done = new Map<string, number>();
    for (const delivery of q.data.deliveries) for (const item of delivery.items) done.set(item.orderItemId, (done.get(item.orderItemId) ?? 0) + item.qty);
    setDeliverQty(Object.fromEntries(q.data.items.map((item) => [item.id, Math.max(0, item.qty - (done.get(item.id) ?? 0))])));
  }, [q.data]);

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

  const deliver = useMutation({
    mutationFn: () => api.post<OrderDetail>(`/admin/orders/${id}/deliveries`, {
      trackingNumber: trackingNumber || undefined,
      note: deliveryNote || undefined,
      items: Object.entries(deliverQty).filter(([, qty]) => qty > 0).map(([orderItemId, qty]) => ({ orderItemId, qty })),
    }),
    onSuccess: (order) => {
      push(order.status === "delivered" ? "اكتمل تسليم الطلب وتم تحديث الحساب" : "تم تسجيل الشحنة الجزئية", "ok");
      setTrackingNumber(""); setDeliveryNote("");
      qc.invalidateQueries({ queryKey: ["admin-order", id] });
      qc.invalidateQueries({ queryKey: ["admin-board"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "accounts"] });
    },
    onError: (e) => push(errorText(e), "err"),
  });

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (q.isError || !q.data) return <ErrorBox text={errorText(q.error)} onRetry={() => q.refetch()} />;
  const o = q.data;
  const next = ORDER_TRANSITIONS[o.status].filter((status) => status !== "delivered");
  const shipped = new Map<string, number>();
  for (const delivery of o.deliveries) for (const item of delivery.items) shipped.set(item.orderItemId, (shipped.get(item.orderItemId) ?? 0) + item.qty);

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight className="h-4 w-4" /> الطلبات</Link>
        <button className="btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</button>
      </div>
      <PrintHeader />
      <div className="print:hidden flex justify-end"><button className="btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة الفاتورة / PDF</button></div>
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
                  {(shipped.get(i.id) ?? 0) > 0 && <p className="mt-1 text-xs text-success">تم تسليم {shipped.get(i.id)} من {i.qty}</p>}
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
          {o.deliveries.length > 0 && <section className="card space-y-3 p-4 print:break-inside-avoid">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Truck className="h-5 w-5 text-primary" /> سجل التسليمات</h2>
            {o.deliveries.map((delivery) => <article key={delivery.id} className="rounded-xl border border-line/10 p-3 text-sm">
              <div className="flex justify-between gap-3"><span>{dateTime(delivery.deliveredAt)}</span><b className="text-primary">{money(delivery.amount)}</b></div>
              {delivery.trackingNumber && <p className="mt-1 text-muted">رقم الشحنة: <span dir="ltr">{delivery.trackingNumber}</span></p>}
              {delivery.note && <p className="mt-1 text-muted">{delivery.note}</p>}
            </article>)}
          </section>}
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
            {o.status === "ready" && <form className="space-y-3 border-t border-line/10 pt-4" onSubmit={(event) => { event.preventDefault(); if (Object.values(deliverQty).some((qty) => qty > 0)) deliver.mutate(); }}>
              <h3 className="flex items-center gap-2 font-display font-bold"><Truck className="h-4 w-4 text-primary" /> تسجيل شحنة</h3>
              <div className="space-y-2">{o.items.map((item) => {
                const left = item.qty - (shipped.get(item.id) ?? 0);
                if (!left) return null;
                return <label key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium">{item.productName}</span><span className="text-xs text-muted">{item.variantLabel} · متبقي {left}</span></span>
                  <input aria-label={"الكمية المسلمة " + item.variantLabel} className="input w-24 text-center" type="number" min="0" max={left} value={deliverQty[item.id] ?? 0} onChange={(event) => setDeliverQty((current) => ({ ...current, [item.id]: Math.min(left, Math.max(0, Number(event.target.value) || 0)) }))} />
                </label>;
              })}</div>
              <label className="label">رقم الشحنة / التتبع<input className="input" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={100} /></label>
              <label className="label">ملاحظة<input className="input" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} maxLength={500} /></label>
              <button type="submit" className="btn-primary w-full" disabled={deliver.isPending || !Object.values(deliverQty).some((qty) => qty > 0)} aria-busy={deliver.isPending}>{deliver.isPending ? "جارٍ التسجيل..." : "تأكيد الشحنة"}</button>
            </form>}
          </div>
        </aside>
      </div>
    </div>
  );
}
