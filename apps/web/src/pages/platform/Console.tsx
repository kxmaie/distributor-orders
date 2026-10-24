import { useCallback, useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Building2, CircleAlert, Database, HardDrive, KeyRound, LogIn, LogOut, Pause, Play, Plus, RefreshCw, ShieldCheck } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL)?.replace(/\/$/, "") || "/api/v1";
type Tenant = { id: string; slug: string; display_name: string; status: "active" | "suspended"; created_at: string; updated_at: string; last_backup_at: string | null; backup_count: string };
type Backup = { id: string; tenant_slug: string; file_name: string; checksum_sha256: string; size_bytes: string; created_at: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/platform${path}`, { ...init, credentials: "include", headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
  return data as T;
}

export default function PlatformConsole() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedInAs, setLoggedInAs] = useState("");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [tenantRows, backupRows] = await Promise.all([request<Tenant[]>("/tenants"), request<Backup[]>("/backups")]);
    setTenants(tenantRows);
    setBackups(backupRows);
  }, []);

  useEffect(() => {
    request<{ username: string }>("/session").then(({ username: user }) => { setLoggedInAs(user); return load(); }).catch((e) => setError(e.message));
  }, [load]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await request<{ username: string }>("/login", { method: "POST", body: JSON.stringify({ username, password }) });
      setPassword(""); setLoggedInAs(result.username); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تسجيل الدخول"); }
    finally { setBusy(false); }
  }

  async function createTenant(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await request("/tenants", { method: "POST", body: JSON.stringify({ slug, name, databaseUrl }) });
      setSlug(""); setName(""); setDatabaseUrl(""); setNotice("تم تسجيل العميل. بيانات الاتصال لم تعد ظاهرة في الواجهة."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تسجيل العميل"); }
    finally { setBusy(false); }
  }

  async function toggleTenant(tenant: Tenant) {
    setBusy(true); setError(""); setNotice("");
    try {
      await request(`/tenants/${encodeURIComponent(tenant.slug)}/status`, { method: "PATCH", body: JSON.stringify({ status: tenant.status === "active" ? "suspended" : "active" }) });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "تعذر تحديث العميل"); }
    finally { setBusy(false); }
  }

  async function logout() {
    await request("/logout", { method: "POST" }).catch(() => undefined);
    setLoggedInAs(""); setTenants([]); setBackups([]);
  }

  return <main dir="rtl" className="min-h-dvh bg-bg px-4 py-8 text-text sm:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line/20 bg-card p-6 shadow-xl">
        <div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary"><ShieldCheck size={25}/></div><div><h1 className="text-2xl font-extrabold">إدارة المنصة والعملاء</h1><p className="mt-1 text-sm text-muted">لوحة مالك المنصة — قواعد العملاء والنسخ الاحتياطي</p></div></div>
        {loggedInAs && <button className="btn-secondary inline-flex items-center gap-2" onClick={logout}><LogOut size={17}/> خروج</button>}
      </motion.header>

      {!loggedInAs && <form onSubmit={login} className="mx-auto max-w-md rounded-3xl border border-line/20 bg-card p-6 shadow-xl">
        <div className="mb-5 flex items-center gap-3"><KeyRound className="text-primary"/><div><h2 className="text-lg font-bold">دخول مالك المنصة</h2><p className="text-sm text-muted">حساب مستقل عن حسابات العملاء</p></div></div>
        <label className="mb-3 block text-sm">اسم المستخدم<input className="input mt-2 w-full" value={username} onChange={(e)=>setUsername(e.target.value)} autoComplete="username" required/></label>
        <label className="mb-4 block text-sm">كلمة المرور<input className="input mt-2 w-full" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
        <button className="btn-primary inline-flex w-full items-center justify-center gap-2" disabled={busy}><LogIn size={17}/>{busy?"جارٍ الدخول…":"دخول آمن"}</button>
        {error !== "PLATFORM_UNAUTHORIZED" && <p className="mt-3 text-sm text-danger">{error}</p>}
      </form>}

      {loggedInAs && <>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">تم تسجيل الدخول كـ <b className="text-text">{loggedInAs}</b></p><button onClick={()=>{setError("");load().catch(e=>setError(e.message));}} className="btn-secondary inline-flex items-center gap-2"><RefreshCw size={16}/> تحديث</button></div>
        {error && <p className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"><CircleAlert className="me-2 inline" size={17}/>{error}</p>}
        {notice && <p className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">{notice}</p>}

        <section className="grid gap-6 lg:grid-cols-[1.3fr_.7fr]">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-line/20 bg-card p-6 shadow-lg">
            <div className="mb-5 flex items-center gap-3"><Building2 className="text-primary"/><div><h2 className="text-xl font-bold">العملاء</h2><p className="text-sm text-muted">إيقاف العميل يمنع دخوله فورًا ويحفظ بياناته.</p></div></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-muted"><tr><th className="py-3 text-start">العميل</th><th className="py-3 text-start">المساحة</th><th className="py-3 text-start">الحالة</th><th className="py-3 text-start">النسخ</th><th className="py-3"></th></tr></thead><tbody>{tenants.map((tenant)=><tr key={tenant.id} className="border-t border-line/10"><td className="py-4 font-bold">{tenant.display_name}</td><td className="py-4 font-mono text-xs">{tenant.slug}</td><td className="py-4"><span className={tenant.status==="active"?"rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-400":"rounded-full bg-amber-500/15 px-3 py-1 text-amber-400"}>{tenant.status==="active"?"نشط":"موقوف"}</span></td><td className="py-4">{tenant.backup_count}</td><td className="py-4"><button disabled={busy} onClick={()=>toggleTenant(tenant)} className="btn-secondary inline-flex items-center gap-1">{tenant.status==="active"?<><Pause size={15}/> إيقاف</>:<><Play size={15}/> تفعيل</>}</button></td></tr>)}</tbody></table>{tenants.length===0&&<p className="py-8 text-center text-muted">لا يوجد عملاء مسجلون بعد.</p>}</div>
          </motion.div>

          <motion.form onSubmit={createTenant} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 rounded-3xl border border-line/20 bg-card p-6 shadow-lg">
            <div className="flex items-center gap-3"><Database className="text-primary"/><div><h2 className="text-xl font-bold">إضافة عميل</h2><p className="text-sm text-muted">اربط قاعدة منفصلة جاهزة ومُرحّلة.</p></div></div>
            <label className="block text-sm">اسم العميل<input className="input mt-2 w-full" value={name} onChange={(e)=>setName(e.target.value)} required maxLength={120}/></label>
            <label className="block text-sm">الرابط المختصر<input className="input mt-2 w-full" value={slug} onChange={(e)=>setSlug(e.target.value)} placeholder="company-name" pattern="[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?" required/></label>
            <label className="block text-sm">رابط قاعدة البيانات<input className="input mt-2 w-full font-mono text-xs" type="password" value={databaseUrl} onChange={(e)=>setDatabaseUrl(e.target.value)} autoComplete="new-password" required/></label>
            <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-300">جهّز قاعدة فارغة منفصلة وشغّل ترحيلات النظام وأنشئ حساب مالك العميل قبل الربط. الرابط يُرسل مشفرًا للـAPI ولا يعود في الرد.</p>
            <button className="btn-primary inline-flex w-full items-center justify-center gap-2" disabled={busy}><Plus size={17}/> تسجيل العميل</button>
          </motion.form>
        </section>

        <section className="rounded-3xl border border-line/20 bg-card p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-3"><HardDrive className="text-primary"/><div><h2 className="text-xl font-bold">النسخ الاحتياطي والاستعادة</h2><p className="text-sm text-muted">ملفات مشفرة محليًا؛ لا نرفع بيانات عملائك إلى تخزين مدفوع.</p></div></div>
          <div className="mb-5 grid gap-3 text-sm text-muted md:grid-cols-2"><p className="rounded-xl bg-bg/70 p-4">إنشاء نسخة: شغّل <code dir="ltr">npm run api:tenant:backup</code> من بيئة تشغيل موثوقة بعد تجهيز متغيرات التحكم ومفتاح التشفير.</p><p className="rounded-xl bg-bg/70 p-4">الاستعادة تحتاج قاعدة هدف فارغة وتأكيد اسم العميل: <code dir="ltr">npm run api:tenant:restore</code>.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="text-muted"><tr><th className="py-3 text-start">العميل</th><th className="py-3 text-start">الملف المشفر</th><th className="py-3 text-start">الحجم</th><th className="py-3 text-start">تاريخ النسخة</th></tr></thead><tbody>{backups.map((b)=><tr key={b.id} className="border-t border-line/10"><td className="py-3">{b.tenant_slug}</td><td className="py-3 font-mono text-xs">{b.file_name}</td><td className="py-3">{(Number(b.size_bytes)/1024/1024).toFixed(2)} MB</td><td className="py-3">{new Date(b.created_at).toLocaleString("ar-EG")}</td></tr>)}</tbody></table>{backups.length===0&&<p className="py-6 text-center text-muted">لا توجد نسخ مسجلة حتى الآن.</p>}</div>
        </section>
      </>}
    </div>
  </main>;
}
