import { AnimatePresence, motion } from "framer-motion";
import { Download, RefreshCw, Share, WifiOff, X } from "lucide-react";
import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useInstall, useOnline } from "../hooks/usePWA";
import { SPRING } from "./motion";

const HOUR = 60 * 60 * 1000;
const DISMISS_KEY = "install-dismissed-at";

/** "New version available" — the user decides when to reload, so a half-filled cart/checkout is never lost. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (reg) setInterval(() => { reg.update().catch(() => undefined); }, HOUR); // check for a new build hourly
    },
  });
  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={SPRING}
          className="card fixed inset-x-3 z-[70] flex items-center gap-3 border-primary/40 p-3 shadow-glow md:inset-x-auto md:end-6 md:w-96"
          style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
        >
          <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
          <p className="flex-1 text-sm font-medium">يتوفر إصدار جديد من التطبيق</p>
          <button className="btn-primary min-h-10 px-4 text-sm" onClick={() => updateServiceWorker(true)}>تحديث</button>
          <button aria-label="لاحقًا" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-line/5" onClick={() => setNeedRefresh(false)}>
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} transition={SPRING}
          className="fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 bg-danger px-4 pb-2 text-sm font-semibold text-white"
          style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
        >
          <WifiOff className="h-4 w-4" /> لا يوجد اتصال بالإنترنت — ستعود الخدمة تلقائيًا عند عودة الشبكة
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function recentlyDismissed() {
  try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < 7 * 24 * HOUR; } catch { return false; }
}

/** Mobile-only "install" card (distributor layout). Android/Chrome: native prompt. iOS: instructions. */
export function InstallBanner() {
  const { canPrompt, showIosHint, installed, install } = useInstall();
  const [hidden, setHidden] = useState(recentlyDismissed);
  const show = !installed && !hidden && (canPrompt || showIosHint);
  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={SPRING}
          className="card fixed inset-x-3 z-30 flex items-center gap-3 p-3 md:hidden"
          style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
        >
          <img src="/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">ثبّت Turk-pen على هاتفك</p>
            {canPrompt
              ? <p className="text-xs text-muted">وصول أسرع وتجربة بملء الشاشة</p>
              : <p className="text-xs text-muted">اضغط <Share className="inline h-3.5 w-3.5 align-text-bottom" /> ثم «إضافة إلى الشاشة الرئيسية»</p>}
          </div>
          {canPrompt && <button className="btn-primary min-h-10 px-4 text-sm" onClick={install}>تثبيت</button>}
          <button aria-label="إغلاق" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:bg-line/5" onClick={dismiss}>
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Profile-page entry point: always available, even after the banner was dismissed. */
export function InstallButton() {
  const { canPrompt, showIosHint, installed, install } = useInstall();
  if (installed) return null;
  if (canPrompt)
    return <button className="btn-ghost" onClick={install}><Download className="h-4 w-4" /> تثبيت Turk-pen على الجهاز</button>;
  if (showIosHint)
    return <p className="card p-3 text-sm text-muted">لتثبيت التطبيق: اضغط <Share className="inline h-4 w-4 align-text-bottom" /> في Safari ثم «إضافة إلى الشاشة الرئيسية».</p>;
  return null;
}
