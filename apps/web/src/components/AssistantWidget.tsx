import { upload } from "@vercel/blob/client";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowUp, Check, FileSpreadsheet, ImagePlus, LoaderCircle, Paperclip, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { api, ApiError, errorText } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { useAuth } from "../store/auth";

type ProductProposal = { name: string; categoryId: number; basePrice: string; unit: "piece" | "meter" | "sqm"; description?: string; sku?: string; variantLabel?: string; initialStock?: number; imageUrl?: string; imageRef?: string };
type Action =
  | { type: "none" }
  | { type: "create_order"; items: { variantId: string; productName: string; variantLabel: string; qty: number }[]; notes?: string }
  | { type: "create_distributor"; username: string; fullName: string; phone?: string }
  | { type: "import_products"; products: ProductProposal[] };
type Quote = { lines: { productName: string; variantLabel: string; qty: number; lineTotal: string }[]; total: string; shortages: unknown[]; fulfillableWarehouses: { id: number; name: string }[] };
type Plan = { message: string; action: Action; quote?: Quote };
type Entry = { id: string; role: "user" | "assistant"; content: string; plan?: Plan; completed?: string; photos?: File[] };
type CsvAttachment = { name: string; rows: Record<string, string>[] };

function csvRows(source: string): Record<string, string>[] {
  const matrix: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"' && quoted && source[i + 1] === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && source[i + 1] === "\n") i++; row.push(cell.trim()); if (row.some(Boolean)) matrix.push(row); row = []; cell = ""; }
    else cell += c;
  }
  row.push(cell.trim()); if (row.some(Boolean)) matrix.push(row);
  if (matrix.length < 2) throw new Error("الملف لازم يحتوي على عناوين أعمدة وصف واحد على الأقل.");
  const headers = matrix[0].map((h) => h.replace(/^\uFEFF/, "").trim());
  if (headers.some((h) => !h)) throw new Error("فيه عنوان عمود فاضي في الملف.");
  if (matrix.length > 101) throw new Error("الحد الأقصى 100 صف في كل مرة.");
  return matrix.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

const localImageName = (ref?: string) => ref?.split(/[\\/]/).pop()?.toLocaleLowerCase();

export default function AssistantWidget() {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [csv, setCsv] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeEntry, setActiveEntry] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  if (!user) return null;

  async function send() {
    const prompt = draft.trim();
    if ((!prompt && !csv) || busy) return;
    setBusy(true); setError("");
    const userEntry: Entry = { id: crypto.randomUUID(), role: "user", content: prompt || "راجع الملف المرفق واقترح استيراد المنتجات." };
    setEntries((old) => [...old, userEntry]); setDraft("");
    try {
      let attachment: CsvAttachment | undefined;
      if (csv) {
        if (csv.size > 2 * 1024 * 1024) throw new Error("الحد الأقصى لملف CSV هو 2 ميجابايت.");
        attachment = { name: csv.name, rows: csvRows(await csv.text()) };
      }
      const history = entries.slice(-10).map(({ role, content }) => ({ role, content }));
      const plan = await api.post<Plan>("/assistant/plan", { prompt: userEntry.content, history, attachment, imageNames: photos.map((file) => file.name) });
      setEntries((old) => [...old, { id: crypto.randomUUID(), role: "assistant", content: plan.message, plan, photos }]);
      setCsv(null); setPhotos([]);
      if (fileRef.current) fileRef.current.value = "";
      if (imageRef.current) imageRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error && !(e instanceof ApiError) ? e.message : e instanceof ApiError && e.code === "AI_NOT_CONFIGURED" ? "المساعد مش متوصل بمفتاح AI في إعدادات الخادم." : errorText(e));
    } finally { setBusy(false); }
  }

  async function confirm(entry: Entry) {
    const action = entry.plan?.action;
    if (!action || action.type === "none" || activeEntry) return;
    setActiveEntry(entry.id); setError("");
    try {
      if (action.type === "create_order") {
        if (!entry.plan?.quote || entry.plan.quote.shortages.length || !entry.plan.quote.fulfillableWarehouses.length) throw new Error("فيه نقص في المخزون أو مفيش مخزن يقدر يجهز الطلب.");
        const result = await api.post<{ orderNo: string }>("/orders", { items: action.items.map(({ variantId, qty }) => ({ variantId, qty })), notes: action.notes });
        setEntries((old) => old.map((m) => m.id === entry.id ? { ...m, completed: `اتعمل الطلب ${result.orderNo} بنجاح.` } : m));
      } else if (action.type === "create_distributor") {
        const password = passwords[entry.id] ?? "";
        if (password.length < 12) throw new Error("كلمة المرور لازم تكون 12 حرفًا على الأقل.");
        await api.post("/admin/users", { username: action.username, fullName: action.fullName, phone: action.phone || undefined, password, role: "distributor", defaultDiscountPct: "0" });
        setEntries((old) => old.map((m) => m.id === entry.id ? { ...m, completed: `اتضاف حساب الموزع ${action.fullName} بنجاح. احتفظ بكلمة المرور اللي أدخلتها وشاركها معه بطريقة آمنة.` } : m));
      } else if (action.type === "import_products") {
        let added = 0;
        const failures: string[] = [];
        for (const product of action.products) {
          try {
            let imageUrl = product.imageUrl;
            if (product.imageRef) {
              const match = entry.photos?.find((file) => localImageName(file.name) === localImageName(product.imageRef));
              if (!match) throw new Error(`الصورة ${product.imageRef} غير مرفقة`);
              if (!token) throw new Error("جلسة الدخول انتهت");
              const blob = await upload(`products/${match.name.replace(/[^\\w.-]/g, "_")}`, match, { access: "public", handleUploadUrl: "/api/v1/admin/uploads/image", headers: { Authorization: `Bearer ${token}` } });
              imageUrl = blob.url;
            }
            await api.post("/admin/products", { ...product, imageRef: undefined, imageUrl, initialStock: product.initialStock ?? 0 });
            added++;
          } catch (e) { failures.push(`${product.name}: ${e instanceof Error ? e.message : "فشل"}`); }
        }
        const result = `تمت إضافة ${added} من ${action.products.length} منتج.${failures.length ? ` المنتجات التي لم تكتمل: ${failures.slice(0, 8).join("؛ ")}` : ""}`;
        setEntries((old) => old.map((m) => m.id === entry.id ? { ...m, completed: result } : m));
      }
    } catch (e) { setError(e instanceof Error ? e.message : errorText(e)); }
    finally { setActiveEntry(null); }
  }

  const isAdmin = user.role !== "distributor";
  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] end-4 z-[55] flex h-14 items-center gap-2 rounded-full bg-primary px-4 text-white shadow-soft transition hover:scale-[1.03] md:bottom-6" aria-label="افتح المساعد الذكي">
        <Sparkles className="h-5 w-5" /><span className="text-sm font-bold">مساعدك الذكي</span>
      </button>
      <AnimatePresence>
        {open && <motion.section dir="rtl" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14 }} className="fixed inset-x-3 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] z-[56] flex max-h-[min(76dvh,700px)] flex-col overflow-hidden rounded-2xl border border-line/15 bg-bg shadow-soft sm:inset-x-auto sm:end-5 sm:w-[min(440px,calc(100vw-2rem))] md:bottom-24">
          <header className="flex items-center gap-3 border-b border-line/10 bg-primary/5 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Sparkles className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1"><h2 className="font-bold">مساعدك الذكي</h2><p className="text-xs text-muted">{isAdmin ? "تقارير، منتجات، وإدارة الموزعين" : "كتالوجك وطلباتك"}</p></div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-line/10" aria-label="إغلاق"><X className="h-5 w-5" /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {entries.length === 0 && <div className="space-y-2 rounded-xl bg-surface2/60 p-4 text-sm text-muted"><p className="font-semibold text-ink">أقدر أساعدك في:</p><ul className="list-inside list-disc space-y-1"><li>{isAdmin ? "تحليل المبيعات والتقارير" : "إنشاء طلب من الكتالوج باللغة العادية"}</li>{isAdmin && <><li>إضافة موزع جديد</li><li>استيراد منتجات من CSV مع صورها</li></>}<li>الإجابة عن أسئلة استخدام النظام</li></ul><p className="text-xs">لإضافة منتجات: أرفق CSV بأعمدة الاسم والسعر والتصنيف، واكتب اسم ملف الصورة في عمود الصورة ثم أرفق الصور المطابقة. أي إضافة أو طلب هتراجعه وتأكدّه قبل الحفظ.</p></div>}
            {entries.map((entry) => <article key={entry.id} className={`rounded-xl p-3 text-sm ${entry.role === "user" ? "ms-8 bg-primary/10" : "me-3 bg-surface2/70"}`}>
              <p className="whitespace-pre-wrap leading-6">{entry.content}</p>
              {entry.plan?.action.type === "create_order" && <div className="mt-3 space-y-2 rounded-lg border border-line/10 bg-bg/70 p-3"><p className="font-bold">مراجعة الطلب</p>{(entry.plan.quote?.lines ?? entry.plan.action.items).map((item, index) => <p key={`${item.productName}-${index}`} className="flex justify-between gap-2 text-xs"><span>{item.productName} · {item.variantLabel} × {item.qty}</span></p>)}{entry.plan.quote && <><p className="border-t border-line/10 pt-2 text-xs text-muted">المخزن: {entry.plan.quote.fulfillableWarehouses[0]?.name ?? "غير متاح"}</p><p className="text-sm font-bold">الإجمالي بعد تسعير النظام: {formatCurrency(entry.plan.quote.total)}</p></>}{!entry.completed && <button type="button" onClick={() => void confirm(entry)} disabled={!!activeEntry || !entry.plan.quote || !!entry.plan.quote.shortages.length || !entry.plan.quote.fulfillableWarehouses.length} className="btn-primary mt-2 w-full text-xs">{activeEntry === entry.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} تأكيد وإنشاء الطلب</button>}</div>}
              {entry.plan?.action.type === "create_distributor" && <div className="mt-3 space-y-2 rounded-lg border border-line/10 bg-bg/70 p-3"><p className="font-bold">مراجعة بيانات الموزع</p><p>الاسم: {entry.plan.action.fullName}</p><p dir="ltr" className="text-start">اسم المستخدم: {entry.plan.action.username}</p>{entry.plan.action.phone && <p dir="ltr" className="text-start">الهاتف: {entry.plan.action.phone}</p>}<label className="block text-xs text-muted">كلمة مرور مؤقتة (12 حرفًا على الأقل)<input type="password" autoComplete="new-password" className="input mt-1" value={passwords[entry.id] ?? ""} onChange={(e) => setPasswords((old) => ({ ...old, [entry.id]: e.target.value }))} /></label>{!entry.completed && <button type="button" onClick={() => void confirm(entry)} disabled={!!activeEntry || (passwords[entry.id] ?? "").length < 12} className="btn-primary w-full text-xs">{activeEntry === entry.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} تأكيد إضافة الموزع</button>}</div>}
              {entry.plan?.action.type === "import_products" && <div className="mt-3 space-y-2 rounded-lg border border-line/10 bg-bg/70 p-3"><p className="font-bold">مراجعة {entry.plan.action.products.length} منتج قبل الإضافة</p><div className="max-h-40 space-y-1 overflow-y-auto">{entry.plan.action.products.map((product, index) => <p key={`${product.name}-${index}`} className="flex justify-between gap-2 text-xs"><span className="min-w-0 truncate">{product.name}{product.imageRef ? " · صورة مرفقة" : ""}</span><span className="shrink-0">{product.basePrice}</span></p>)}</div>{!entry.completed && <button type="button" onClick={() => void confirm(entry)} disabled={!!activeEntry} className="btn-primary w-full text-xs">{activeEntry === entry.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} تأكيد إضافة المنتجات</button>}</div>}
              {entry.completed && <p className="mt-2 rounded-lg bg-success/10 p-2 text-xs text-success">{entry.completed}</p>}
            </article>)}
            {busy && <div className="me-3 flex items-center gap-2 rounded-xl bg-surface2/70 p-3 text-xs text-muted"><LoaderCircle className="h-4 w-4 animate-spin" /> بفهم طلبك…</div>}
            {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 p-3 text-xs text-danger"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
          </div>
          <form className="space-y-2 border-t border-line/10 p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            {(csv || photos.length > 0) && <div className="flex flex-wrap gap-2">{csv && <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs"><FileSpreadsheet className="h-3.5 w-3.5" />{csv.name}<button type="button" onClick={() => setCsv(null)} aria-label="إزالة الملف"><X className="h-3.5 w-3.5" /></button></span>}{photos.map((file) => <span key={`${file.name}-${file.size}`} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs"><ImagePlus className="h-3.5 w-3.5 shrink-0" /><span className="max-w-36 truncate">{file.name}</span><button type="button" onClick={() => setPhotos((old) => old.filter((x) => x !== file))} aria-label="إزالة الصورة"><X className="h-3.5 w-3.5" /></button></span>)}</div>}
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { setCsv(e.target.files?.[0] ?? null); setError(""); }} />
            <input ref={imageRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={(e) => { setPhotos(Array.from(e.target.files ?? []).slice(0, 100)); setError(""); }} />
            <div className="flex items-end gap-2"><div className="flex gap-1"><button type="button" title="إرفاق ملف CSV" onClick={() => fileRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-line/10"><Paperclip className="h-4 w-4" /></button>{isAdmin && <button type="button" title="إرفاق صور المنتجات" onClick={() => imageRef.current?.click()} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-line/10"><ImagePlus className="h-4 w-4" /></button>}</div><textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={1} maxLength={2000} placeholder={isAdmin ? "مثال: ضيف موزع جديد أو لخص مبيعات الشهر…" : "مثال: اعملي أوردر 20 متر من المنتج…"} className="input max-h-24 min-h-10 flex-1 resize-y py-2.5 text-sm" /><button type="submit" disabled={busy || (!draft.trim() && !csv)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white disabled:opacity-40" aria-label="إرسال"><ArrowUp className="h-5 w-5" /></button></div>
          </form>
        </motion.section>}
      </AnimatePresence>
    </>
  );
}







