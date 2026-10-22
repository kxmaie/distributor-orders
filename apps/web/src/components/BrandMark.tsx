/** The Turk-pen roof + four-pane window, drawn with the current text colour (set it with text-primary etc.). */
export default function BrandMark({ className = "", muted = false }: { className?: string; muted?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 220 190" className={className}>
      <path d="M12 92 L110 22 L208 92" fill="none" stroke="currentColor" strokeWidth={muted ? 9 : 8} strokeLinecap="round" strokeLinejoin="round" />
      <rect x="152" y="20" width="14" height="38" fill="currentColor" />
      <rect x="62" y="84" width="96" height="96" rx="6" fill="rgb(var(--primary) / .12)" stroke="currentColor" strokeWidth={muted ? 6 : 5} />
      <path d="M110 84 V180 M62 132 H158" stroke="currentColor" strokeWidth={muted ? 6 : 5} />
    </svg>
  );
}

/** Highest discount (%) the distributor gets across a product's variants, from server-priced values (display only). */
export function maxDiscountPct(variants: { price: string; yourPrice: string }[]): number {
  let best = 0;
  for (const v of variants) {
    const base = Number(v.price), mine = Number(v.yourPrice);
    if (base > 0 && mine < base) best = Math.max(best, Math.round((1 - mine / base) * 100));
  }
  return best;
}
