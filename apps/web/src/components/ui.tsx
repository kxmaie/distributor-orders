import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Minus, Plus, PackageOpen, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import type { OrderStatus } from "@do/shared";
import { STATUS_CLASS, STATUS_LABEL } from "../lib/status";

export const Spinner = ({ className = "" }: { className?: string }) => <Loader2 className={`h-5 w-5 animate-spin ${className}`} aria-label="جارٍ التحميل" />;

/**
 * Button content with a loading state that does NOT change the button's width: the label stays in
 * the layout (invisible) while a spinner is centred over it. Pair with `aria-busy` on the button.
 */
export function BtnLabel({ loading, children }: { loading?: boolean; children: ReactNode }) {
  return (
    <span className="relative inline-flex items-center justify-center gap-2">
      <span className={`inline-flex items-center gap-2 transition-opacity ${loading ? "opacity-0" : ""}`}>{children}</span>
      {loading && <Spinner className="absolute" />}
    </span>
  );
}

export const Skeleton = ({ className = "" }: { className?: string }) => <div className={`skeleton ${className}`} />;

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <PackageOpen className="h-12 w-12 text-muted" />
      <h3 className="text-lg font-bold">{title}</h3>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action}
    </motion.div>
  );
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-wrap items-center justify-between gap-3 border-danger/30 p-4 text-danger">
      <span>{text}</span>
      {onRetry && <button className="btn-ghost" onClick={onRetry}>إعادة المحاولة</button>}
    </div>
  );
}

export function QtyStepper({ value, onChange, min = 1, max = 9999 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, Math.floor(n) || min)));
  return (
    <div className="inline-flex items-center rounded-xl border border-line/15 bg-surface2/70" dir="ltr">
      <button type="button" aria-label="إنقاص" className="grid h-11 w-11 place-items-center disabled:opacity-40" disabled={value <= min} onClick={() => set(value - 1)}>
        <Minus className="h-4 w-4" />
      </button>
      <input
        aria-label="الكمية" inputMode="numeric" value={value}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")))}
        className="h-11 w-14 bg-transparent text-center font-semibold focus:outline-none"
      />
      <button type="button" aria-label="زيادة" className="grid h-11 w-11 place-items-center disabled:opacity-40" disabled={value >= max} onClick={() => set(value + 1)}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Modal({
  open, title, onClose, children, wide,
}: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <div key="modal" className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal aria-labelledby="modal-title">
          <motion.button
            type="button" aria-label="إغلاق" onClick={onClose}
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          {/* Bottom sheet on phones (slides up), centred dialog from `sm` up. */}
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className={`card relative max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-b-none p-5 sm:rounded-b-xl2 ${wide ? "max-w-2xl" : "max-w-md"}`}
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="modal-title" className="font-display text-xl font-bold">{title}</h2>
              <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-line/5" aria-label="إغلاق" onClick={onClose}>
                <X className="h-5 w-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
