import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, PartyPopper } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useOrder } from "../hooks/queries";
import { api, errorText } from "../lib/api";
import { dateTime, money } from "../lib/format";
import { useUI } from "../store/ui";
import OrderTimeline from "../components/OrderTimeline";
import { BtnLabel, ErrorBox, Skeleton, StatusBadge } from "../components/ui";

export default function OrderDetails() {
  const { id = "" } = useParams();
  const placed = (useLocation().state as { justPlaced?: boolean } | null)?.justPlaced;
  const { data: o, isLoading, error, refetch } = useOrder(id);
  const qc = useQueryClient();
  const push = useUI((s) => s.push);

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

  return (
    <div className="space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight className="h-4 w-4" /> كل الطلبات</Link>

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
