import { AnimatePresence, motion } from "framer-motion";
import { useUI } from "../store/ui";

const cls = {
  ok: "border-success/40 text-success",
  success: "border-success/40 text-success",
  err: "border-danger/40 text-danger",
  danger: "border-danger/40 text-danger",
  info: "border-line/20 text-ink",
};

export default function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" style={{ marginBottom: "env(safe-area-inset-bottom)" }} role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={() => dismiss(t.id)}
            className={`card pointer-events-auto max-w-md border px-4 py-3 text-sm font-medium ${cls[t.kind]}`}
          >
            {t.msg}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
