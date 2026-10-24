import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "../../lib/api";
import { money } from "../../lib/format";
import { useUI } from "../../store/ui";
import type { AdminProduct, Page, Warehouse } from "../../lib/types";

type Purchase = { id: string; invoiceNo: string; supplier: string; total: string; createdAt: string; items: { id: string; qty: number; unitCost: string; lineTotal: string; variant: { product: { name: string }; label: string } }[] };
type PurchaseLine = { variantId: string; qty: number; unitCost: string };
export default function Purchases() {
  const push = useUI((s) => s.push); const qc = useQueryClient();
  const [supplier, setSupplier] = useState(""); const [invoiceNo, setInvoiceNo] = useState(""); const [warehouseId, setWarehouseId] = useState(0);
  const [lines, setLines] = useState<PurchaseLine[]>([{ variantId: "", qty: 1, unitCost: "" }]);
  const products = useQuery({ queryKey: ["purchase-products"], queryFn: () => api.get<Page<AdminProduct>>("/admin/products", { page: 1, pageSize: 100 }) });
  const warehouses = useQuery({ queryKey: ["purchase-warehouses"], queryFn: () => api.get<Warehouse[]>("/admin/warehouses") });
  const purchases = useQuery({ queryKey: ["purchases"], queryFn: () => api.get<Purchase[]>("/admin/purchases") });
  const profit = useQuery({ queryKey: ["profit-loss"], queryFn: () => api.get<{ revenue: string; costOfGoodsSold: string; grossProfit: string; purchasesTotal: string; uncostedQty: number }>("/admin/reports/profit-loss") });
  const create = useMutation({
    mutationFn: () => api.post("/admin/purchases", { supplier, invoiceNo: invoiceNo || undefined, warehouseId, items: lines }),
    onSuccess: () => { push("اتسجلت فاتورة المشتريات وزاد المخزون", "ok"); setSupplier(""); setInvoiceNo(""); setLines([{ variantId: "", qty: 1, unitCost: "" }]); qc.invalidateQueries({ queryKey: ["purchases"] }); qc.invalidateQueries({ queryKey: ["profit-loss"] }); qc.invalidateQueries({ queryKey: ["admin", "stock"] }); },
    onError: (e) => push(errorText(e), "err"),
  });
  const variants = products.data?.items.flatMap((p) => p.variants.map((v) => ({ id: v.id, title: `${p.name} · ${v.label} · ${v.sku}` }))) ?? [];
  const total = lines.reduce((sum, line) => sum + (Number(line.unitCost) || 0) * (Number(line.qty) || 0), 0);
  const updateLine = (index: number, patch: Partial<PurchaseLine>) => setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
  const valid = lines.length > 0 && lines.every((line) => line.variantId && line.qty > 0 && line.unitCost !== "" && Number(line.unitCost) >= 0);
  return <div className="space-y-6">
    <header><h1 className="font-display text-2xl font-extrabold">فواتير المشتريات</h1><p className="mt-1 text-sm text-muted">كل فاتورة تزيد رصيد المخزون في المخزن المحدد.</p></header>
    <div className="grid gap-4 sm:grid-cols-4">{[["إيراد المبيعات", profit.data?.revenue], ["تكلفة البضاعة المباعة", profit.data?.costOfGoodsSold], ["مجمل الربح", profit.data?.grossProfit], ["إجمالي المشتريات", profit.data?.purchasesTotal]].map(([label,value]) => <div className="card p-4" key={label}><p className="text-xs text-muted">{label}</p><b className="mt-1 block text-lg text-primary">{value ? money(value) : "—"}</b></div>)}</div>
    <p className="text-xs text-muted">مجمل الربح محسوب باستخدام متوسط تكلفة الشراء المسجلة لكل صنف، ولا يشمل المصروفات التشغيلية والضرائب.</p>{(profit.data?.uncostedQty ?? 0) > 0 && <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-500">هناك {profit.data?.uncostedQty} وحدة مباعة لم يُسجل لها سعر شراء، لذلك لا تدخل تكلفتها في حساب مجمل الربح.</p>}
    <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate(); }}>
      <h2 className="font-display text-lg font-bold">تسجيل فاتورة</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="label">المورد<input className="input" value={supplier} onChange={(e) => setSupplier(e.target.value)} required maxLength={160} /></label>
        <label className="label">رقم الفاتورة<input className="input" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} maxLength={60} placeholder="يُنشأ تلقائيًا إذا تُرك فارغًا" /></label>
        <label className="label">المخزن<select className="input" value={warehouseId || ""} onChange={(e) => setWarehouseId(Number(e.target.value))} required><option value="">اختر مخزنًا</option>{warehouses.data?.filter((w) => w.isActive).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      </div>
      <div className="space-y-3">{lines.map((line, index) => <div key={index} className="grid items-end gap-3 rounded-xl border border-line/10 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <label className="label">الصنف<select className="input" value={line.variantId} onChange={(e) => updateLine(index, { variantId: e.target.value })} required><option value="">اختر صنفًا</option>{variants.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select></label>
        <label className="label">الكمية<input className="input" type="number" min={1} value={line.qty} onChange={(e) => updateLine(index, { qty: Number(e.target.value) })} required /></label>
        <label className="label">تكلفة الوحدة<input className="input" type="number" min={0} step="0.01" value={line.unitCost} onChange={(e) => updateLine(index, { unitCost: e.target.value })} required /></label>
        <button type="button" className="btn-ghost text-danger" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>حذف</button>
      </div>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" className="btn-ghost" onClick={() => setLines((current) => [...current, { variantId: "", qty: 1, unitCost: "" }])}>إضافة صنف للفاتورة</button><strong>الإجمالي: {money(total)}</strong></div>
      <button className="btn-primary" disabled={create.isPending || !supplier.trim() || !warehouseId || !valid}>حفظ الفاتورة وترحيلها للمخزون</button>
    </form>
    <section className="card overflow-hidden"><h2 className="p-5 font-display text-lg font-bold">آخر الفواتير</h2>{purchases.data?.map((p) => <article key={p.id} className="flex flex-wrap justify-between gap-2 border-t border-line/10 p-4"><div><b>{p.invoiceNo} · {p.supplier}</b><p className="mt-1 text-xs text-muted">{p.items.map((i) => `${i.variant.product.name} (${i.variant.label}) × ${i.qty}`).join("، ")}</p></div><strong className="text-primary">{money(p.total)}</strong></article>)}{purchases.isError && <p className="p-4 text-sm text-danger">{errorText(purchases.error)}</p>}</section>
  </div>;
}