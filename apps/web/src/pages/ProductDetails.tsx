import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useProduct } from "../hooks/queries";
import { errorText } from "../lib/api";
import { money, UNIT_LABEL } from "../lib/format";
import { useCart } from "../store/cart";
import { useUI } from "../store/ui";
import BrandMark from "../components/BrandMark";
import { ErrorBox, QtyStepper, Skeleton } from "../components/ui";

export default function ProductDetails() {
  const { id = "" } = useParams();
  const { data: p, isLoading, error, refetch } = useProduct(id);
  const add = useCart((s) => s.add);
  const setOpen = useCart((s) => s.setOpen);
  const push = useUI((s) => s.push);
  const [vid, setVid] = useState<string>();
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (p && !vid) setVid((p.variants.find((v) => v.inStock) ?? p.variants[0])?.id);
  }, [p, vid]);

  if (isLoading) return <div className="grid gap-6 md:grid-cols-2"><Skeleton className="aspect-[4/3]" /><div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-5 w-1/3" /><Skeleton className="h-32" /></div></div>;
  if (error || !p) return <ErrorBox text={errorText(error)} onRetry={() => refetch()} />;

  const v = p.variants.find((x) => x.id === vid);
  const canAdd = !!v && v.inStock;

  function addToCart() {
    if (!v || !p) return;
    add({ variantId: v.id, productId: p.id, productName: p.name, variantLabel: v.label, sku: v.sku, unit: p.unit }, qty);
    push("تمت الإضافة إلى السلة", "ok");
    setOpen(true);
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <Link to="/catalog" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight className="h-4 w-4" /> كل المنتجات</Link>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card aspect-[2/1] overflow-hidden bg-gradient-to-br from-surface2 to-bg md:aspect-[4/3]">
          {p.imageUrl ? <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-primary/40"><BrandMark muted className="h-3/4 w-auto md:h-auto md:w-40" /></div>}
        </div>
        <div className="space-y-5">
          <div>
            <p className="text-sm text-muted">{p.category.name}</p>
            <h1 className="font-display text-3xl font-extrabold">{p.name}</h1>
          </div>
          {p.description && <p className="leading-relaxed text-muted">{p.description}</p>}

          {p.variants.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm text-muted">المقاس / اللون / نوع الزجاج</legend>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((x) => (
                  <button key={x.id} type="button" onClick={() => setVid(x.id)} aria-pressed={x.id === vid}
                    className={`chip ${x.id === vid ? "chip-active" : ""} ${!x.inStock ? "opacity-50" : ""}`}>
                    {x.id === vid && <Check className="me-1 h-4 w-4" />}{x.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {v ? (
            <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
              <p className="font-display text-3xl font-extrabold text-primary">{money(v.yourPrice)} <span className="text-base font-medium text-muted">/ {p.unitLabel}</span></p>
              {p.piecesPerUnit > 1 && <p className="text-sm text-muted">سعر القطعة {money(Number(v.yourPrice) / p.piecesPerUnit)} · {p.piecesPerUnit} قطعة في {p.unitLabel} · إجمالي الوحدة {money(v.yourPrice)}</p>}
              {v.yourPrice !== v.price && (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <span className="line-through">{money(v.price)}</span>
                  {Number(v.price) > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">خصمك {Math.round((1 - Number(v.yourPrice) / Number(v.price)) * 100)}%</span>}
                </p>
              )}
              <p className={`text-sm ${v.inStock ? "text-success" : "text-danger"}`}>{v.inStock ? `متوفر (${v.available})` : "غير متوفر حاليًا"}</p>
            </motion.div>
          ) : <p className="text-muted">لا توجد خيارات متاحة لهذا المنتج</p>}

          {/* On phones the add-to-cart row sticks above the bottom tab bar so it is always one tap away. */}
          <div className="sticky z-20 -mx-4 flex flex-wrap items-center gap-3 border-t border-line/10 bg-bg px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0" style={{ bottom: "calc(4.1rem + env(safe-area-inset-bottom))" }}>
            <QtyStepper value={qty} onChange={setQty} max={v?.available ? Math.max(1, v.available) : 9999} />
            <motion.button whileTap={{ scale: 0.97 }} className="btn-primary flex-1" disabled={!canAdd} onClick={addToCart}>أضف للسلة</motion.button>
          </div>
          <p className="text-xs text-muted">السعر النهائي والخصم يتم احتسابهما في الخادم عند إتمام الطلب.</p>
        </div>
      </div>
    </div>
  );
}
