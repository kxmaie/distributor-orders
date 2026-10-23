import { upload } from "@vercel/blob/client";
import { ImagePlus, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "../../store/auth";

export default function ImageUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const token = useAuth((s) => s.token);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function chooseFile(file?: File) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      setError("اختار صورة JPG أو PNG أو WebP أو AVIF بحد أقصى 5 ميجابايت");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const blob = await upload(`products/${file.name.replace(/[^\w.-]/g, "_")}`, file, {
        access: "public",
        handleUploadUrl: "/api/v1/admin/uploads/image",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      onChange(blob.url);
    } catch {
      setError("تعذر رفع الصورة. تأكد من إعداد تخزين الصور في Vercel ثم حاول مرة أخرى.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input name="imageUrl" aria-label="رابط الصورة" className="input min-w-0 flex-1 font-mono text-xs" dir="ltr" placeholder="https://... أو ارفع صورة من جهازك" value={value} onChange={(e) => onChange(e.target.value)} />
        <input ref={input} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => void chooseFile(e.target.files?.[0])} />
        <button type="button" className="btn-ghost shrink-0 px-3 text-xs" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {busy ? "يرفع الصورة" : "من الجهاز"}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {value && <img src={value} alt="معاينة صورة المنتج" className="h-20 w-20 rounded-xl border border-line/10 bg-surface2 object-cover" />}
    </div>
  );
}
