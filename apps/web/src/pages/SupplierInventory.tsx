import { useQuery } from "@tanstack/react-query";
import { Boxes, Search } from "lucide-react";
import { useState } from "react";
import { api, errorText } from "../lib/api";
import type { Page } from "../lib/types";
import { ErrorBox, Skeleton } from "../components/ui";

type InventoryItem = { id: string; name: string; imageUrl: string | null; unitLabel: string; category: { name: string }; variants: { id: string; label: string; available: number; inStock: boolean }[] };
export default function SupplierInventory() {
  const [q, setQ] = useState("");
  const result = useQuery({ queryKey: ["supplier-inventory", q], queryFn: () => api.get<Page<InventoryItem>>("/supplier/inventory", { q: q || undefined, page: 1, pageSize: 100 }) });
  return <div className="space-y-5">
    <header><h1 className="font-display text-2xl font-extrabold">المخزون المتاح</h1><p className="mt-1 text-sm text-muted">عرض المنتجات والكميات المتاحة فقط.</p></header>
    <div className="relative"><Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" /><input className="input ps-12" placeholder="ابحث عن منتج…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
    {result.isError && <ErrorBox text={errorText(result.error)} onRetry={() => result.refetch()} />}
    {result.isLoading && <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>}
    {result.data && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{result.data.items.map((product) => <article key={product.id} className="card flex gap-4 p-4">
      {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-20 w-20 rounded-xl object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Boxes /></div>}
      <div className="min-w-0 flex-1"><p className="text-xs text-muted">{product.category.name}</p><h2 className="truncate font-bold">{product.name}</h2><p className="text-xs text-muted">{product.unitLabel}</p>
        <ul className="mt-2 space-y-1 text-sm">{product.variants.map((variant) => <li key={variant.id} className="flex justify-between gap-2"><span className="truncate">{variant.label}</span><b className={variant.inStock ? "text-success" : "text-danger"}>{variant.available} {product.unitLabel}</b></li>)}</ul>
      </div></article>)}</div>}
    {result.data?.items.length === 0 && <div className="card p-8 text-center text-muted">لا توجد منتجات مطابقة.</div>}
  </div>;
}
