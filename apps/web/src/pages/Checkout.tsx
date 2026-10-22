import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCartQuote } from "../hooks/queries";
import { api, ApiError, errorText } from "../lib/api";
import { money } from "../lib/format";
import type { OrderDetail, Shortage } from "../lib/types";
import { useCart } from "../store/cart";
import { useUI } from "../store/ui";
import { BtnLabel, EmptyState, ErrorBox, Skeleton } from "../components/ui";

export default function Checkout() {
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const nav = useNavigate();
  const qc = useQueryClient();
  const push = useUI((s) => s.push);
  const quote = useCartQuote();
  const [notes, setNotes] = useState("");
  const [serverShortages, setServerShortages] = useState<Shortage[]>([]);

  const place = useMutation({
    mutationFn: () => api.post<OrderDetail>("/orders", { items: items.map((i) => ({ variantId: i.variantId, qty: i.qty })), notes: notes.trim() || undefined }),
    onSuccess: (o) => {
      clear();
      qc.invalidateQueries({ queryKey: ["orders"] });
      push(`تم إرسال الطلب ${o.orderNo}`, "ok");
      nav(`/orders/${o.id}`, { replace: true, state: { justPlaced: true } });
    },
    onError: (e) => {
      setServerShortages(e instanceof ApiError && e.code === "INSUFFICIENT_STOCK" && Array.isArray(e.details) ? (e.details as Shortage[]) : []);
      push(errorText(e), "err");
      quote.refetch();
    },
  });

  if (items.length === 0)
    return <EmptyState title="السلة فارغة" hint="أضف منتجات أولًا" action={<Link to="/catalog" className="btn-primary">تصفح المنتجات</Link>} />;

  const p = quote.data;
  const nameOf = (variantId: string) => items.find((i) => i.variantId === variantId)?.productName ?? "";
  const blocked = !p || p.shortages.length > 0 || p.fulfillableWarehouses.length === 0;
  const hints: Shortage[] = serverShortages.length ? serverShortages : p?.shortages ?? [];

  const send = () => { setServerShortages([]); place.mutate(); };

  return (
    <div className="grid gap-6 pb-20 md:grid-cols-[1fr_22rem] md:pb-0">
      <section className="space-y-4">
        <h1 className="font-display text-2xl font-extrabold">مراجعة الطلب</h1>
        {quote.isError && <ErrorBox text={errorText(quote.error)} onRetry={() => quote.refetch()} />}
        {!p && quote.isLoading && <Skeleton className="h-48" />}
        {p && (
          <ul className="space-y-3">
            {p.lines.map((l) => (
              <motion.li layout key={l.variantId} className="card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{l.productName}</p>
                  <p className="text-sm text-muted">{l.variantLabel} · {l.qty} × {money(l.unitPrice)}{Number(l.discountPct) > 0 && ` · خصم ${Number(l.discountPct)}%`}</p>
                </div>
                <p className="font-display font-bold text-primary">{money(l.lineTotal)}</p>
              </motion.li>
            ))}
          </ul>
        )}
        {hints.length > 0 && (
          <div role="alert" className="card space-y-2 border-danger/30 p-4 text-sm text-danger">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> كميات غير متوفرة</p>
            <ul className="list-inside list-disc">
              {hints.map((s) => <li key={s.variantId}>{nameOf(s.variantId) || s.sku}: المطلوب {s.requested}{s.available !== undefined && ` والمتاح ${s.available}`}</li>)}
            </ul>
            <p>عدّل الكميات من السلة (أيقونة السلة بالأعلى).</p>
          </div>
        )}
        {p && p.shortages.length === 0 && p.fulfillableWarehouses.length === 0 && (
          <p role="alert" className="text-sm text-danger">لا يوجد مخزن واحد يغطي كل الأصناف، قسّم الطلب إلى طلبين.</p>
        )}
        <label className="block space-y-1 text-sm">
          <span className="text-muted">ملاحظات (اختياري)</span>
          <textarea className="input min-h-24 py-3" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </section>

      <aside className="card h-fit space-y-4 p-5 md:sticky md:top-24">
        <h2 className="font-display text-lg font-bold">الملخص</h2>
        {p ? (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between text-muted"><dt>قبل الخصم</dt><dd>{money(p.subtotal)}</dd></div>
            {Number(p.discountTotal) > 0 && <div className="flex justify-between text-success"><dt>الخصم</dt><dd>- {money(p.discountTotal)}</dd></div>}
            <div className="flex justify-between border-t border-line/10 pt-2 font-display text-xl font-bold"><dt>الإجمالي</dt><dd className="text-primary">{money(p.total)}</dd></div>
            {p.fulfillableWarehouses[0] && <p className="pt-1 text-xs text-muted">يُجهَّز من: {p.fulfillableWarehouses[0].name}</p>}
          </dl>
        ) : <Skeleton className="h-24" />}
        <button className="btn-primary hidden w-full md:inline-flex" aria-busy={place.isPending} disabled={blocked || quote.isFetching || place.isPending} onClick={send}>
          <BtnLabel loading={place.isPending}>إرسال الطلب</BtnLabel>
        </button>
        <p className="text-xs text-muted">سيراجع فريقنا الطلب ويؤكده، ويمكنك إلغاؤه قبل التأكيد.</p>
      </aside>

      {/* Phones: total + send button stay visible above the bottom tab bar. */}
      <div className="fixed inset-x-0 z-20 flex items-center gap-3 border-t border-line/10 bg-bg px-4 py-3 md:hidden" style={{ bottom: "calc(4.1rem + env(safe-area-inset-bottom))" }}>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">الإجمالي</p>
          <p className="truncate font-display text-lg font-bold text-primary">{p ? money(p.total) : "…"}</p>
        </div>
        <button className="btn-primary px-8" aria-busy={place.isPending} disabled={blocked || quote.isFetching || place.isPending} onClick={send}>
          <BtnLabel loading={place.isPending}>إرسال الطلب</BtnLabel>
        </button>
      </div>
    </div>
  );
}
