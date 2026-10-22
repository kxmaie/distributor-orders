import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCategories, useProducts } from "../hooks/queries";
import { errorText } from "../lib/api";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import { Stagger } from "../components/motion";
import { EmptyState, ErrorBox } from "../components/ui";

export default function Catalog() {
  const [sp, setSp] = useSearchParams();
  const category = sp.get("category") ?? undefined;
  const q = sp.get("q") ?? "";
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const [text, setText] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== q) setSp((p) => { const n = new URLSearchParams(p); if (text) n.set("q", text); else n.delete("q"); n.delete("page"); return n; }, { replace: true });
    }, 350);
    return () => clearTimeout(t);
  }, [text, q, setSp]);

  const cats = useCategories();
  const res = useProducts({ category, q: q || undefined, page });
  const set = (k: string, v?: string) => setSp((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); if (k !== "page") n.delete("page"); return n; });
  const pages = res.data ? Math.max(1, Math.ceil(res.data.total / res.data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold">المنتجات</h1>
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input className="input ps-12" placeholder="ابحث عن منتج…" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button className={`chip shrink-0 ${!category ? "chip-active" : ""}`} onClick={() => set("category")}>الكل</button>
        {cats.data?.map((c) => (
          <button key={c.id} className={`chip shrink-0 ${category === c.slug ? "chip-active" : ""}`} onClick={() => set("category", c.slug)}>{c.name}</button>
        ))}
      </div>

      {res.isError && <ErrorBox text={errorText(res.error)} onRetry={() => res.refetch()} />}
      {res.isLoading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      )}
      {res.data && (
        // key = the current filter, so every new search / category / page replays the staggered entrance.
        <Stagger key={`${category ?? ""}|${q}|${page}`} className={`grid grid-cols-2 gap-4 transition-opacity md:grid-cols-3 lg:grid-cols-4 ${res.isPlaceholderData ? "opacity-60" : ""}`}>
          {res.data.items.map((p) => <ProductCard key={p.id} p={p} />)}
        </Stagger>
      )}
      {res.data && res.data.items.length === 0 && <EmptyState title="لا توجد منتجات مطابقة" hint="جرّب كلمات بحث أخرى أو تصنيفًا مختلفًا" />}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>السابق</button>
          <span className="text-sm text-muted">{page} / {pages}</span>
          <button className="btn-ghost" disabled={page >= pages} onClick={() => set("page", String(page + 1))}>التالي</button>
        </div>
      )}
    </div>
  );
}
