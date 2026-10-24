import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Pencil, Plus, Printer, Save, Trash2, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ORDER_TRANSITIONS, type OrderStatus } from "@do/shared";
import OrderTimeline from "../../components/OrderTimeline";
import { ErrorBox, Skeleton, Spinner, StatusBadge } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { dateTime, money } from "../../lib/format";
import { STATUS_LABEL } from "../../lib/status";
import { useUI } from "../../store/ui";
import type { AdminProduct, OrderDetail, Page } from "../../lib/types";
import PrintHeader from "../../components/PrintHeader";

type EditLine = { variantId: string; qty: number };
function printInvoice(orderNo: string) {
  const previousTitle = document.title;
  document.title = `فاتورة-${orderNo}`;
  document.body.classList.add("print-order-invoice");
  window.addEventListener("afterprint", () => { document.body.classList.remove("print-order-invoice"); document.title = previousTitle; }, { once: true });
  window.print();
}
export default function AdminOrderDetails() {
  const { id = "" } = useParams();
  const [note, setNote] = useState(""); const [trackingNumber, setTrackingNumber] = useState(""); const [deliveryNote, setDeliveryNote] = useState("");
  const [deliverQty, setDeliverQty] = useState<Record<string, number>>({}); const [editing, setEditing] = useState(false);
  const [editLines, setEditLines] = useState<EditLine[]>([]); const [adminDiscount, setAdminDiscount] = useState("0.00");
  const push = useUI((s) => s.push); const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-order", id], queryFn: () => api.get<OrderDetail>(`/admin/orders/${id}`) });
  const products = useQuery({ queryKey: ["purchase-products"], queryFn: () => api.get<Page<AdminProduct>>("/admin/products", { page: 1, pageSize: 100 }), enabled: editing });
  useEffect(() => {
    if (!q.data) return; const done = new Map<string, number>();
    for (const delivery of q.data.deliveries) for (const item of delivery.items) done.set(item.orderItemId, (done.get(item.orderItemId) ?? 0) + item.qty);
    setDeliverQty(Object.fromEntries(q.data.items.map((item) => [item.id, Math.max(0, item.qty - (done.get(item.id) ?? 0))])));
    if (!editing) { setEditLines(q.data.items.map((item) => ({ variantId: item.variantId, qty: item.qty }))); setAdminDiscount(q.data.adminDiscount || "0.00"); }
  }, [q.data, editing]);
  const change = useMutation({
    mutationFn: (status: OrderStatus) => api.patch<OrderDetail>(`/admin/orders/${id}/status`, { status, note: note || undefined }),
    onSuccess: () => { push("تم تحديث حالة الطلب", "ok"); setNote(""); qc.invalidateQueries({ queryKey: ["admin-order", id] }); qc.invalidateQueries({ queryKey: ["admin-board"] }); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
    onError: (error) => push(errorText(error), "err"),
  });
  const saveEdit = useMutation({
    mutationFn: () => api.patch<OrderDetail>(`/admin/orders/${id}`, { items: editLines, adminDiscount: adminDiscount || "0" }),
    onSuccess: () => { push("تم تعديل الطلب والخصم وتحديث حجز المخزون", "ok"); setEditing(false); qc.invalidateQueries({ queryKey: ["admin-order", id] }); qc.invalidateQueries({ queryKey: ["admin-board"] }); qc.invalidateQueries({ queryKey: ["admin-orders"] }); },
    onError: (error) => push(errorText(error), "err"),
  });
  const deliver = useMutation({
    mutationFn: () => api.post<OrderDetail>(`/admin/orders/${id}/deliveries`, { trackingNumber: trackingNumber || undefined, note: deliveryNote || undefined, items: Object.entries(deliverQty).filter(([, qty]) => qty > 0).map(([orderItemId, qty]) => ({ orderItemId, qty })) }),
    onSuccess: (order) => { push(order.status === "delivered" ? "اكتمل تسليم الطلب وتم تحديث الحساب" : "تم تسجيل الشحنة الجزئية", "ok"); setTrackingNumber(""); setDeliveryNote(""); qc.invalidateQueries({ queryKey: ["admin-order", id] }); qc.invalidateQueries({ queryKey: ["admin-board"] }); qc.invalidateQueries({ queryKey: ["admin-orders"] }); qc.invalidateQueries({ queryKey: ["admin", "accounts"] }); },
    onError: (error) => push(errorText(error), "err"),
  });
  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (q.isError || !q.data) return <ErrorBox text={errorText(q.error)} onRetry={() => q.refetch()} />;
  const o = q.data; const next = ORDER_TRANSITIONS[o.status].filter((status) => status !== "delivered");
  const shipped = new Map<string, number>(); for (const delivery of o.deliveries) for (const item of delivery.items) shipped.set(item.orderItemId, (shipped.get(item.orderItemId) ?? 0) + item.qty);
  const variants = products.data?.items.flatMap((product) => product.variants.filter((variant) => variant.isActive).map((variant) => ({ id: variant.id, title: `${product.name} · ${variant.label}`, price: variant.priceDelta }))) ?? [];
  const editValid = editLines.length > 0 && editLines.every((line) => line.variantId && Number.isInteger(line.qty) && line.qty > 0) && new Set(editLines.map((line) => line.variantId)).size === editLines.length && Number(adminDiscount) >= 0 && Number(adminDiscount) <= Number(o.subtotal);
  const startEditing = () => { setEditLines(o.items.map((item) => ({ variantId: item.variantId, qty: item.qty }))); setAdminDiscount(o.adminDiscount || "0.00"); setEditing(true); };
  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><Link to="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight className="h-4 w-4" /> الطلبات</Link><button className="btn-primary" onClick={() => printInvoice(o.orderNo)}><Printer className="h-4 w-4" /> طباعة الفاتورة / حفظ PDF</button></div>
      <article className="order-invoice space-y-4">
        <PrintHeader title={`فاتورة طلب ${o.orderNo}`} />
        <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-extrabold" dir="ltr">{o.orderNo}</h1><p className="text-sm text-muted">{dateTime(o.createdAt)} · {o.warehouse.name}</p>{o.user && <p className="text-sm">العميل: {o.user.fullName} <span dir="ltr" className="text-muted">({o.user.username}{o.user.phone ? ` · ${o.user.phone}` : ""})</span></p>}</div><StatusBadge status={o.status} /></header>
        <section className="space-y-3"><ul className="space-y-3">{o.items.map((item) => <li key={item.id} className="card flex items-center justify-between gap-3 p-4 print:rounded-none print:border-line/20 print:p-2"><div><p className="font-semibold">{item.productName}</p><p className="text-sm text-muted">{item.variantLabel} · {item.qty} × {money(item.unitPrice)}{Number(item.discountPct) > 0 && ` · خصم ${Number(item.discountPct)}%`}</p></div><p className="font-display font-bold text-primary">{money(item.lineTotal)}</p></li>)}</ul>
          <dl className="card space-y-2 p-4 text-sm print:rounded-none print:p-3"><div className="flex justify-between text-muted"><dt>قبل الخصم</dt><dd>{money(o.subtotal)}</dd></div>{Number(o.discountTotal) > 0 && <div className="flex justify-between text-success"><dt>إجمالي الخصم</dt><dd>- {money(o.discountTotal)}</dd></div>}{Number(o.adminDiscount) > 0 && <div className="flex justify-between text-success"><dt>خصم إضافي من الإدارة</dt><dd>- {money(o.adminDiscount)}</dd></div>}<div className="flex justify-between font-display text-xl font-bold"><dt>الإجمالي النهائي</dt><dd className="text-primary">{money(o.total)}</dd></div></dl>{o.notes && <p className="card p-4 text-sm text-muted">ملاحظات الطلب: {o.notes}</p>}</section>
      </article>
      {["new", "confirmed", "ready"].includes(o.status) && o.deliveries.length === 0 && <section className="card space-y-4 p-5 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold">تعديل الطلب والخصم</h2><p className="text-xs text-muted">التعديل متاح قبل اعتماد الطلب؛ الأسعار الحالية للأصناف الأصلية محفوظة.</p></div>{!editing && <button type="button" className="btn-ghost" onClick={startEditing}><Pencil className="h-4 w-4" />تعديل الأصناف</button>}</div>
        {editing && <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (editValid) saveEdit.mutate(); }}><div className="space-y-2">{editLines.map((line, index) => <div key={index} className="grid items-end gap-2 rounded-xl border border-line/10 p-3 sm:grid-cols-[2fr_1fr_auto]"><label className="label">الصنف<select className="input" value={line.variantId} onChange={(event) => setEditLines((current) => current.map((item, i) => i === index ? { ...item, variantId: event.target.value } : item))} required><option value="">اختر صنفًا</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.title}</option>)}</select></label><label className="label">الكمية<input className="input" type="number" min={1} max={100000} value={line.qty} onChange={(event) => setEditLines((current) => current.map((item, i) => i === index ? { ...item, qty: Number(event.target.value) } : item))} required /></label><button type="button" className="btn-ghost text-danger" aria-label="حذف الصنف" disabled={editLines.length <= 1} onClick={() => setEditLines((current) => current.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></button></div>)}</div>
          <button type="button" className="btn-ghost" onClick={() => setEditLines((current) => [...current, { variantId: "", qty: 1 }])}><Plus className="h-4 w-4" />إضافة صنف</button>
          <label className="label">خصم إضافي على إجمالي الطلب (ج.م)<input className="input max-w-xs" type="number" min="0" step="0.01" max={o.subtotal} value={adminDiscount} onChange={(event) => setAdminDiscount(event.target.value)} /></label>
          {!editValid && <p className="text-sm text-danger">راجع الأصناف والكميات وقيمة الخصم.</p>}
          <div className="flex flex-wrap gap-2"><button type="submit" className="btn-primary" disabled={!editValid || saveEdit.isPending}>{saveEdit.isPending ? <Spinner /> : <Save className="h-4 w-4" />}حفظ التعديل</button><button type="button" className="btn-ghost" disabled={saveEdit.isPending} onClick={() => setEditing(false)}><X className="h-4 w-4" />إلغاء</button></div></form>}
      </section>}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] print:hidden">
        <section>{o.deliveries.length > 0 && <div className="card space-y-3 p-4"><h2 className="flex items-center gap-2 font-display text-lg font-bold"><Truck className="h-5 w-5 text-primary" /> سجل التسليمات</h2>{o.deliveries.map((delivery) => <article key={delivery.id} className="rounded-xl border border-line/10 p-3 text-sm"><div className="flex justify-between gap-3"><span>{dateTime(delivery.deliveredAt)}</span><b className="text-primary">{money(delivery.amount)}</b></div>{delivery.trackingNumber && <p className="mt-1 text-muted">رقم الشحنة: <span dir="ltr">{delivery.trackingNumber}</span></p>}{delivery.note && <p className="mt-1 text-muted">{delivery.note}</p>}</article>)}</div>}</section>
        <aside className="space-y-4"><div className="card space-y-4 p-5"><h2 className="font-display text-lg font-bold">الحالة</h2><OrderTimeline order={o} />{next.length > 0 && <div className="space-y-3 border-t border-line/10 pt-4"><label className="label">ملاحظة (اختياري)<input className="input" value={note} onChange={(event) => setNote(event.target.value)} maxLength={255} /></label><div className="flex flex-col gap-2">{next.map((status) => <button key={status} className={status === "cancelled" ? "btn-danger" : "btn-primary"} disabled={change.isPending} onClick={() => { if (status === "cancelled" && !window.confirm("تأكيد إلغاء الطلب؟")) return; change.mutate(status); }}>{change.isPending ? <Spinner /> : STATUS_LABEL[status]}</button>)}</div></div>}{o.status === "ready" && <form className="space-y-3 border-t border-line/10 pt-4" onSubmit={(event) => { event.preventDefault(); if (Object.values(deliverQty).some((qty) => qty > 0)) deliver.mutate(); }}><h3 className="flex items-center gap-2 font-display font-bold"><Truck className="h-4 w-4 text-primary" /> تسجيل شحنة</h3><div className="space-y-2">{o.items.map((item) => { const left = item.qty - (shipped.get(item.id) ?? 0); if (!left) return null; return <label key={item.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{item.productName}</span><span className="text-xs text-muted">{item.variantLabel} · متبقي {left}</span></span><input aria-label={"الكمية المسلمة " + item.variantLabel} className="input w-24 text-center" type="number" min="0" max={left} value={deliverQty[item.id] ?? 0} onChange={(event) => setDeliverQty((current) => ({ ...current, [item.id]: Math.min(left, Math.max(0, Number(event.target.value) || 0)) }))} /></label>; })}</div><label className="label">رقم الشحنة / التتبع<input className="input" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={100} /></label><label className="label">ملاحظة<input className="input" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} maxLength={500} /></label><button type="submit" className="btn-primary w-full" disabled={deliver.isPending || !Object.values(deliverQty).some((qty) => qty > 0)} aria-busy={deliver.isPending}>{deliver.isPending ? "جارٍ التسجيل..." : "تأكيد الشحنة"}</button></form>}</div></aside>
      </div>
    </div>
  );
}
