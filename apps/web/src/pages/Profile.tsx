import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, LogOut, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { api, errorText } from "../lib/api";
import { useAuth } from "../store/auth";
import { useCart } from "../store/cart";
import { useUI } from "../store/ui";
import { InstallButton } from "../components/PWAPrompts";

const ROLE = { distributor: "موزع", admin: "أدمن", super_admin: "مدير النظام" } as const;

export default function Profile() {
  const user = useAuth((s) => s.user)!;
  const clearAuth = useAuth((s) => s.clear);
  const clearCart = useCart((s) => s.clear);
  const { theme, toggleTheme, push } = useUI();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function logout() {
    try { await api.post("/auth/logout"); } catch { /* ignore: we clear local state either way */ }
    clearCart(); qc.clear(); clearAuth();
  }
  async function requestReset() {
    setBusy(true);
    try { await api.post("/auth/password-request", { username: user.username }); push("تم إرسال طلب إعادة تعيين كلمة المرور للأدمن", "ok"); }
    catch (e) { push(errorText(e), "err"); }
    finally { setBusy(false); }
  }

  const rows: [string, string, boolean][] = [["الاسم", user.fullName, false], ["اسم المستخدم", user.username, true], ["الصلاحية", ROLE[user.role], false]];
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="font-display text-2xl font-extrabold">ملفي</h1>
      <dl className="card divide-y divide-line/10">
        {rows.map(([k, v, ltr]) => (
          <div key={k} className="flex items-center justify-between p-4"><dt className="text-muted">{k}</dt><dd className="font-semibold" dir={ltr ? "ltr" : undefined}>{v}</dd></div>
        ))}
      </dl>
      <div className="grid gap-3">
        {user.role !== "distributor" && (
          <Link to="/admin" className="btn-primary"><LayoutDashboard className="h-4 w-4" /> لوحة الأدمن</Link>
        )}
        <button className="btn-ghost" onClick={toggleTheme}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {theme === "dark" ? "المظهر الفاتح" : "المظهر الداكن"}</button>
        <InstallButton />
        <button className="btn-ghost" disabled={busy} aria-busy={busy} onClick={requestReset}>طلب إعادة تعيين كلمة المرور</button>
        <button className="btn-danger" onClick={logout}><LogOut className="h-4 w-4" /> تسجيل الخروج</button>
      </div>
    </div>
  );
}
