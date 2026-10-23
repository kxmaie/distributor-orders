import { upload } from "@vercel/blob/client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ImagePlus, LoaderCircle, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../../store/auth";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export default function ImageUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const token = useAuth((s) => s.token);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  async function chooseFile(file?: File) {
    if (!file) return;
    setError("");
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
      setError("اختار صورة JPG أو PNG أو WebP أو AVIF بحد أقصى 5 ميجابايت.");
      return;
    }
    if (!token) {
      setError("انتهت جلسة الدخول. سجّل الدخول مرة أخرى ثم ارفع الصورة.");
      return;
    }

    setBusy(true);
    try {
      const safeName = file.name.replace(/[^\w.-]/g, "_").slice(-100) || "product-image";
      const pathname = `products/${Date.now()}-${window.crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: new URL("/api/v1/admin/uploads/image", window.location.origin).toString(),
        headers: { Authorization: `Bearer ${token}` },
      });
      onChange(blob.url);
    } catch {
      setError("تعذر رفع الصورة. تأكد من اتصال الإنترنت وحاول مرة أخرى.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2.5">
      {/* Keep the uploaded URL in FormData when the surrounding product form is saved. */}
      <input type="hidden" name="imageUrl" value={value} />
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        aria-label="اختيار صورة للمنتج من الجهاز"
        onChange={(e) => void chooseFile(e.target.files?.[0])}
      />

      <motion.div
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void chooseFile(e.dataTransfer.files?.[0]); }}
        animate={{ scale: dragging ? 1.015 : 1, borderColor: dragging ? "rgb(var(--primary))" : "rgb(var(--line) / .15)" }}
        transition={{ type: "spring", stiffness: 320, damping: 25 }}
        className={`relative overflow-hidden rounded-2xl border border-dashed bg-surface2/45 p-3 transition-colors ${dragging ? "bg-primary/10 shadow-glow" : "hover:bg-surface2/70"}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {value ? (
            <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex items-center gap-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line/15 bg-surface2 shadow-soft">
                <img src={value} alt="معاينة صورة المنتج" className="h-full w-full object-cover" />
                <span className="absolute bottom-1 end-1 grid h-5 w-5 place-items-center rounded-full bg-success text-white shadow"><CheckCircle2 className="h-3.5 w-3.5" /></span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs font-bold text-ink"><ImagePlus className="h-4 w-4 text-primary" /> الصورة جاهزة</p>
                <p className="mt-1 text-[11px] text-muted">هتظهر في كتالوج المنتجات بعد الحفظ.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost min-h-8 px-2.5 py-1 text-[11px]" onClick={() => input.current?.click()} disabled={busy}>تغيير الصورة</button>
                  <button type="button" className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[11px] text-danger transition hover:bg-danger/10" onClick={() => { onChange(""); setError(""); }} disabled={busy}><Trash2 className="h-3.5 w-3.5" /> حذف</button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-col items-center gap-2 py-3 text-center">
              <motion.div animate={dragging ? { y: -4, rotate: -7 } : { y: [0, -3, 0], rotate: [0, 2, 0] }} transition={dragging ? { duration: 0.2 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
              </motion.div>
              <div>
                <p className="text-xs font-bold text-ink">{busy ? "جاري رفع الصورة…" : dragging ? "أفلت الصورة هنا" : "أضف صورة المنتج من جهازك"}</p>
                <p className="mt-1 text-[10px] text-muted">اسحب الصورة هنا أو اختارها · JPG أو PNG أو WebP أو AVIF · حتى 5 ميجابايت</p>
              </div>
              <button type="button" className="btn-primary min-h-9 px-3 py-1.5 text-[11px]" onClick={() => input.current?.click()} disabled={busy}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {busy ? "يرفع الصورة" : "اختيار صورة"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {error && <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-start gap-1.5 text-xs text-danger"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</motion.p>}
      </AnimatePresence>
    </div>
  );
}
