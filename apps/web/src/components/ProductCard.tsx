import { Link } from "react-router-dom";
import { money, UNIT_LABEL } from "../lib/format";
import type { Product } from "../lib/types";
import BrandMark, { maxDiscountPct } from "./BrandMark";
import { StaggerItem } from "./motion";

/** Render inside <Stagger> so cards fade in one after another. */
export default function ProductCard({ p }: { p: Product }) {
  const prices = p.variants.map((v) => Number(v.yourPrice));
  const from = prices.length ? Math.min(...prices) : Number(p.basePrice);
  const anyStock = p.variants.some((v) => v.inStock);
  const pct = maxDiscountPct(p.variants);
  const basePrices = p.variants.map((v) => Number(v.price));
  const fromBase = basePrices.length ? Math.min(...basePrices) : Number(p.basePrice);
  return (
    <StaggerItem whileHover={{ y: -4 }} whileTap={{ scale: 0.985 }}>
      <Link to={`/products/${p.id}`} className="card group block overflow-hidden transition-shadow hover:shadow-glow">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-surface2 to-bg">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-primary/40"><BrandMark muted className="w-24" /></div>
          )}
          <span className={`absolute end-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${anyStock ? "bg-success/20 text-success" : "bg-danger/20 text-danger"}`}>
            {anyStock ? "متوفر" : "غير متوفر"}
          </span>
          {pct > 0 && <span className="absolute bottom-3 end-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-fg">خصمك {pct}%</span>}
        </div>
        <div className="space-y-1 p-4">
          <p className="text-xs text-muted">{p.category.name}</p>
          <h3 className="line-clamp-2 font-display text-base font-bold">{p.name}</h3>
          <p className="pt-1 text-sm text-muted">
            يبدأ من <span className="font-display text-lg font-bold text-primary">{money(from)}</span> / {p.unitLabel}{p.piecesPerUnit > 1 && <span className="block text-xs">{money(from / p.piecesPerUnit)} للقطعة · {p.piecesPerUnit} قطعة في {p.unitLabel}</span>}
          </p>
          {pct > 0 && <p className="text-xs text-muted line-through">{money(fromBase)}</p>}
        </div>
      </Link>
    </StaggerItem>
  );
}

export const ProductCardSkeleton = () => (
  <div className="card overflow-hidden">
    <div className="skeleton aspect-[4/3] rounded-none" />
    <div className="space-y-2 p-4"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-5 w-3/4" /><div className="skeleton h-5 w-1/2" /></div>
  </div>
);
