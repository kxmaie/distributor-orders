import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, errorText } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useUI } from "../../store/ui";

type Unit = { id: number; name: string; label: string; isActive: boolean };
export default function AdminSettings() {
  const role = useAuth((s) => s.user?.role);
  const push = useUI((s) => s.push);
  const qc = useQueryClient();
  const [limit, setLimit] = useState(20);
  const [unitName, setUnitName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const setting = useQuery({ queryKey: ["order-limit"], queryFn: () => api.get<{ maxOrderItems: number }>("/admin/settings/order-limit") });
  useEffect(() => { if (setting.data) setLimit(setting.data.maxOrderItems); }, [setting.data]);
  const units = useQuery({ queryKey: ["admin-units"], queryFn: () => api.get<Unit[]>("/admin/settings/units"), enabled: role === "super_admin" });
  const saveLimit = useMutation({ mutationFn: () => api.put("/admin/settings/order-limit", { maxOrderItems: limit }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["order-limit"] }); push("تم حفظ الحد الأقصى لأصناف الطلب", "ok"); }, onError: (e) => push(errorText(e), "err") });
  const addUnit = useMutation({ mutationFn: () => api.post("/admin/settings/units", { name: unitName, label: unitLabel }), onSuccess: () => { setUnitName(""); setUnitLabel(""); qc.invalidateQueries({ queryKey: ["admin-units"] }); qc.invalidateQueries({ queryKey: ["units"] }); push("تمت إضافة الوحدة", "ok"); }, onError: (e) => push(errorText(e), "err") });
  const removeUnit = useMutation({ mutationFn: (id: number) => api.del(`/admin/settings/units/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-units"] }); qc.invalidateQueries({ queryKey: ["units"] }); push("تم حذف الوحدة أو إيقافها للمنتجات الحالية", "ok"); }, onError: (e) => push(errorText(e), "err") });
  return <div className="mx-auto max-w-3xl space-y-6">
    <header><h1 className="font-display text-2xl font-extrabold">إعدادات الطلبات والوحدات</h1><p className="mt-1 text-sm text-muted">حدد الحد الأقصى للأصناف في كل طلب. الوحدات يديرها السوبر أدمن.</p></header>
    <section className="card space-y-4 p-5"><h2 className="font-display text-lg font-bold">حد أصناف الطلب</h2><label className="label">أقصى عدد أصناف مختلفة في الطلب (1 إلى 50)<input className="input max-w-xs" type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(Number(e.target.value))} /></label><button className="btn-primary" disabled={saveLimit.isPending || !Number.isInteger(limit) || limit < 1 || limit > 50} onClick={() => saveLimit.mutate()}>حفظ الحد</button></section>
    {role === "super_admin" && <section className="card space-y-4 p-5"><h2 className="font-display text-lg font-bold">وحدات المنتجات</h2><form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); addUnit.mutate(); }}><label className="label">رمز الوحدة<input className="input" value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="carton" maxLength={20} pattern="[A-Za-z0-9_-]+" required /></label><label className="label">الاسم الظاهر<input className="input" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="كرتونة" maxLength={40} required /></label><button className="btn-primary self-end" disabled={addUnit.isPending}>إضافة</button></form><div className="divide-y divide-line/10">{units.data?.map((unit) => <div key={unit.id} className="flex items-center justify-between py-3"><div><b>{unit.label}</b><span className="ms-2 text-xs text-muted" dir="ltr">{unit.name}</span>{!unit.isActive && <span className="ms-2 text-xs text-danger">متوقفة</span>}</div><button className="btn-ghost text-danger" disabled={removeUnit.isPending || !unit.isActive} onClick={() => { if (confirm(`حذف/إيقاف وحدة ${unit.label}؟`)) removeUnit.mutate(unit.id); }}>حذف</button></div>)}</div></section>}
    {setting.isError && <p className="text-sm text-danger">تعذر تحميل الإعدادات: {errorText(setting.error)}</p>}
  </div>;
}
