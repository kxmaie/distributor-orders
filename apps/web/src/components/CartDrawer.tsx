import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCartQuote } from "../hooks/queries";
import { errorText } from "../lib/api";
import { money, UNIT_LABEL } from "../lib/format";
import { cartCount, useCart } from "../store/cart";
import { BtnLabel, EmptyState, QtyStepper, Skeleton } from "./ui";

function Content() {
  const { items, setQty, remove, setOpen } = useCart();
  const nav = useNavigate();
  const quote = useCartQuote();
  const priced = quote.data;
  const price = (id: string) => priced?.lines.find((l) => l.variantId === id);
  const blocked = !priced || priced.shortages.length > 0 || priced.fulfillableWarehouses.length === 0;

  if (items.length === 0)
    return <div className="p-4"><EmptyState title="السلة فارغة" hint="أضف منتجات من الكتالوج لتبدأ طلبك" action={<button className="btn-primary" onClick={() => { setOpen(false); nav("/catalog"); }}>تصفح المنتجات</button>} /></div>;

  return (
    <>
      <ul className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
        <AnimatePresence initial={false}>
          {items.map((i) => {
            const l = price(i.variantId);
            return (
              <motion.li key={i.variantId} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{i.productName}</p>
                    <p className="text-sm text-muted">{i.variantLabel}</p>
                  </div>
                  <button aria-label="حذف" onClick={() => remove(i.variantId)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <QtyStepper value={i.qty} onChange={(n) => setQty(i.variantId, n)} />
                  <div className="text-end">
                    {l ? (
                      <>
                        <p className="font-display font-bold text-primary">{money(l.lineTotal)}</p>
                        <p className="text-xs text-muted">{money(l.unitPrice)} / {UNIT_LABEL[i.unit]}{Number(l.discountPct) > 0 && ` · خصم ${Number(l.discountPct)}%`}</p>
                      </>
                    ) : <Skeleton className="h-5 w-20" />}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <div className="space-y-3 border-t border-line/10 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        {quote.error && <p className="text-sm text-danger">{errorText(quote.error)}</p>}
        {priced && priced.shortages.length > 0 && <p className="text-sm text-danger">بعض الكميات أكبر من المتاح، عدّلها من السلة.</p>}
        {priced && (
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between text-muted"><dt>الإجمالي قبل الخصم</dt><dd>{money(priced.subtotal)}</dd></div>
            {Number(priced.discountTotal) > 0 && <div className="flex justify-between text-success"><dt>الخصم</dt><dd>- {money(priced.discountTotal)}</dd></div>}
            <div className="flex justify-between font-display text-lg font-bold"><dt>الإجمالي</dt><dd className="text-primary">{money(priced.total)}</dd></div>
          </dl>
        )}
        <button className="btn-primary w-full" aria-busy={quote.isFetching} disabled={blocked || quote.isFetching} onClick={() => { setOpen(false); nav("/checkout"); }}><BtnLabel loading={quote.isFetching}>إتمام الطلب</BtnLabel></button>
      </div>
    </>
  );
}

export default function CartDrawer() {
  const { open, setOpen } = useCart();
  const count = useCart((s) => cartCount(s.items));
  const controls = useDragControls();
  const closeBtn = useRef<HTMLButtonElement>(null);

  // While open: lock page scroll, close on Escape, and move focus into the dialog.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    closeBtn.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, setOpen]);

  // Swipe the header toward the screen edge (left) to dismiss — natural on phones.
  const onDragEnd = (_: PointerEvent, info: PanInfo) => {
    if (info.offset.x < -90 || info.velocity.x < -450) setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" className="fixed inset-0 z-40 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside
            key="dr" role="dialog" aria-modal aria-label="سلة الطلب"
            className="fixed inset-y-0 left-0 z-50 flex w-full max-w-md flex-col bg-bg shadow-soft will-change-transform"
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            drag="x" dragControls={controls} dragListener={false}
            dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.6, right: 0 }} onDragEnd={onDragEnd}
          >
            <header
              className="flex touch-none items-center justify-between border-b border-line/10 p-4"
              style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
              onPointerDown={(e) => controls.start(e)}
            >
              <h2 className="flex items-center gap-2 font-display text-xl font-bold"><ShoppingCart className="h-5 w-5 text-primary" /> سلة الطلب {count > 0 && <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-sm font-bold text-primary">{count}</span>}</h2>
              <button ref={closeBtn} aria-label="إغلاق" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-line/5"><X className="h-5 w-5" /></button>
            </header>
            <Content />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
