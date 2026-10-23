import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, PartyPopper, Printer, RotateCcw, Truck } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useOrder } from "../hooks/queries";
import { api, errorText } from "../lib/api";
import { dateTime, money } from "../lib/format";
import { useUI } from "../store/ui";
import OrderTimeline from "../components/OrderTimeline";
import PrintHeader from "../components/PrintHeader";
import { BtnLabel, ErrorBox, Skeleton, StatusBadge } from "../components/ui";
import { useCart } from "../store/cart";

export default function OrderDetails() {
  const { id = "" } = useParams();
  const placed = (useLocation().state as { justPlaced?: boolean } | null)?.justPlaced;
  const { data: o, isLoading, error, refetch } = useOrder(id);
  const qc = useQueryClient();
  const push = useUI((s) => s.push);
  const add = useCart((s) => s.add);
  const setCartOpen = useCart((s) => s.setOpen);

  const cancel = useMutation({
    mutationFn: () => api.post<unknown>(`/orders/${id}/cancel`),
    onSuccess: () => {
      push("تم إلغاء الطلب", "ok");
      qc.invalidateQueries({ queryKey: ["order", id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e) => push(errorText(e), "err"),
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (error || !o) return <ErrorBox text={errorText(error)} onRetry={() => refetch()} />;

  const deliveredQty = new Map<string, number>();
  for (const delivery of o.deliveries) for (const item of delivery.items) {
    deliveredQty.set(item.orderItemId, (deliveredQty.get(item.orderItemId) ?? 0) + item.qty);
  }
  function reorder() {
    if (!o) return;
    for (const item of o.items) add({ variantId: item.variantId, productId: item.productId, productName: item.productName,
      variantLabel: item.variantLabel, sku: item.sku, unit: item.unit }, item.qty);
    push("اتضافت أصناف الطلب للسلة، والأسعار والمخزون هيتراجعوا عند إتمام الطلب", "ok");
    setCartOpen(true);
  }

  return (
      <div className="space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight className="h-4 w-4" /> كل الطلبات</Link>
      <div className="flex flex-wrap justify-end gap-2 print:hidden">
        <button className="btn-ghost" onClick={reorder}><RotateCcw className="h-4 w-4" /> اطلب نفس الأصناف</button>
        <button className="btn-ghost" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة / PDF</button>
      </div>
      <div className="hidden print:block"><PrintHeader title={"فاتورة طلب " + o.orderNo} /></div>

      {placed && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card flex items-center gap-3 border-success/30 p-4 text-success">
          <PartyPopper className="h-6 w-6" /> تم استلام طلبك وسيتم مراجعته قريبًا
        </motion.div>
      )}

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold" dir="ltr">{o.orderNo}</h1>
          <p className="text-sm text-muted">{dateTime(o.createdAt)} · المخزن: {o.warehouse.name}</p>
        </div>
        <StatusBadge status={o.status} />
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">الأصناف</h2>
          <ul className="space-y-3">
            {o.items.map((i) => (
              <li key={i.id} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{i.productName}</p>
                  <p className="text-sm text-muted">{i.variantLabel} · {i.qty} × {money(i.unitPrice)}{Number(i.discountPct) > 0 && ` · خصم ${Number(i.discountPct)}%`}</p>
                  {(deliveredQty.get(i.id) ?? 0) > 0 && <p className="mt-1 text-xs text-success">تم تسليم {deliveredQty.get(i.id)} من {i.qty}</p>}
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
          {o.notes && <p className="card p-4 text-sm text-muted">ملاحظاتك: {o.notes}</p>}
        </section>

        {o.deliveries.length > 0 && <section className="card space-y-3 p-4 md:col-span-2 print:break-inside-avoid">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Truck className="h-5 w-5 text-primary" /> سجل التسليمات</h2>
          <div className="grid gap-3 md:grid-cols-2">{o.deliveries.map((delivery) => <article key={delivery.id} className="rounded-xl border border-line/10 bg-surface2/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{dateTime(delivery.deliveredAt)}</p><span className="font-display font-bold text-primary">{money(delivery.amount)}</span></div>
            {delivery.trackingNumber && <p className="mt-1 text-sm text-muted">رقم الشحنة: <b dir="ltr">{delivery.trackingNumber}</b></p>}
            {delivery.note && <p className="mt-1 text-sm text-muted">{delivery.note}</p>}
          </article>)}</div>
        </section>}

        <aside className="space-y-4">
          <div className="card space-y-4 p-5">
            <h2 className="font-display text-lg font-bold">حالة الطلب</h2>
            <OrderTimeline order={o} />
          </div>
          {o.status === "new" && (
            <button className="btn-danger w-full" aria-busy={cancel.isPending} disabled={cancel.isPending} onClick={() => { if (window.confirm("هل تريد إلغاء هذا الطلب؟")) cancel.mutate(); }}>
              <BtnLabel loading={cancel.isPending}>إلغاء الطلب</BtnLabel>
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
