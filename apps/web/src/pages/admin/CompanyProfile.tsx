import { upload } from "@vercel/blob/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, ImagePlus, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { CompanyProfile } from "../../lib/types";
import { api, errorText } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useUI } from "../../store/ui";

type Form = CompanyProfile;
const empty: Form = { name: "Turk-pen", address: null, taxNumber: null, commercialRegister: null, phone: null, logoUrl: null };
export default function CompanyProfilePage() {
  const token = useAuth((state) => state.token); const push = useUI((state) => state.push); const qc = useQueryClient();
  const [form, setForm] = useState<Form>(empty); const [uploading, setUploading] = useState(false);
  const query = useQuery({ queryKey: ["company-profile"], queryFn: () => api.get<CompanyProfile>("/company-profile") });
  useEffect(() => { if (query.data) setForm(query.data); }, [query.data]);
  const save = useMutation({ mutationFn: () => api.put<CompanyProfile>("/admin/company-profile", form), onSuccess: (value) => { setForm(value); qc.setQueryData(["company-profile"], value); push("تم حفظ بيانات المنشأة", "ok"); }, onError: (error) => push(errorText(error), "err") });
  const set = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value || null }));
  async function uploadLogo(file?: File) {
    if (!file || !token) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { push("اختر صورة أقل من 5 ميجابايت", "err"); return; }
    setUploading(true);
    try { const result = await upload(`company/${file.name.replace(/[^\w.-]/g, "_")}`, file, { access: "public", handleUploadUrl: "/api/v1/admin/uploads/image", headers: { Authorization: `Bearer ${token}` } }); setForm((current) => ({ ...current, logoUrl: result.url })); push("تم رفع الشعار، احفظ البيانات لتثبيته", "ok"); }
    catch (error) { push(errorText(error), "err"); } finally { setUploading(false); }
  }
  return <div className="mx-auto max-w-3xl space-y-6">
    <header><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 /></span><div><h1 className="font-display text-2xl font-extrabold">بيانات المنشأة</h1><p className="mt-1 text-sm text-muted">تظهر هذه البيانات تلقائيًا في الفواتير والتقارير المطبوعة.</p></div></div></header>
    <form className="card space-y-5 p-5" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line/10 p-4">{form.logoUrl ? <img src={form.logoUrl} alt="شعار المنشأة" className="h-20 w-28 rounded-lg bg-white object-contain p-2" /> : <span className="grid h-20 w-28 place-items-center rounded-lg bg-surface2 text-muted"><ImagePlus /></span>}<div className="space-y-2"><p className="font-semibold">شعار المنشأة</p><label className="btn-ghost cursor-pointer">{uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}رفع صورة من الجهاز<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={uploading} onChange={(event) => { void uploadLogo(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{form.logoUrl && <button type="button" className="ms-2 text-sm text-danger" onClick={() => setForm((current) => ({ ...current, logoUrl: null }))}>إزالة الشعار</button>}</div></div>
      <label className="label">اسم المنشأة<input className="input" required maxLength={160} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
      <label className="label">العنوان<input className="input" maxLength={300} value={form.address ?? ""} onChange={(event) => set("address", event.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="label">الرقم الضريبي<input className="input" maxLength={80} value={form.taxNumber ?? ""} onChange={(event) => set("taxNumber", event.target.value)} /></label><label className="label">السجل التجاري<input className="input" maxLength={80} value={form.commercialRegister ?? ""} onChange={(event) => set("commercialRegister", event.target.value)} /></label></div>
      <label className="label">رقم التليفون<input className="input" type="tel" maxLength={30} value={form.phone ?? ""} onChange={(event) => set("phone", event.target.value)} /></label>
      <button className="btn-primary" disabled={save.isPending || uploading}>{save.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}حفظ بيانات المنشأة</button>
    </form>
    {query.isError && <p className="text-sm text-danger">تعذر تحميل البيانات: {errorText(query.error)}</p>}
  </div>;
}
