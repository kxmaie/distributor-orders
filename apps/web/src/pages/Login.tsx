import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { api, errorText } from "../lib/api";
import type { User } from "../lib/types";
import { useAuth } from "../store/auth";
import { BtnLabel } from "../components/ui";
import Logo from "../components/Logo";
import { CheckCircle2 } from "lucide-react";

type Tab = "login" | "forgot" | "register";

export default function Login() {
  const { status, setSession } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };

  // Shared fields
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [tab, setTab] = useState<Tab>("login");

  // Register-only fields
  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  const user = useAuth((s) => s.user);
  const homeFor = (role: User["role"]) => (role === "distributor" ? "/" : "/admin");
  if (status === "authed" && user) return <Navigate to={loc.state?.from ?? homeFor(user.role)} replace />;

  function switchTab(t: Tab) {
    setTab(t);
    setErr("");
    setSent(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      if (tab === "forgot") {
        await api.post("/auth/password-request", { username: username.trim() });
        setSent(true);
      } else if (tab === "register") {
        if (password.length < 12) {
          setErr("كلمة المرور يجب أن تكون 12 حرفاً على الأقل");
          return;
        }
        if (password !== regConfirmPassword) {
          setErr("كلمتا المرور غير متطابقتين");
          return;
        }
        await api.post("/auth/register", {
          username: username.trim(),
          password,
          fullName: regFullName.trim(),
          phone: regPhone.trim() || undefined,
        });
        setSent(true);
      } else {
        const d = await api.post<{ accessToken: string; user: User }>("/auth/login", {
          username: username.trim(),
          password,
        });
        setSession(d.accessToken, d.user);
        nav(loc.state?.from ?? homeFor(d.user.role), { replace: true });
      }
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  }

  if (sent && tab === "register") {
    return (
      <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -start-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
          className="card relative w-full max-w-sm space-y-5 p-6 text-center"
          role="status"
        >
          <Logo className="mx-auto h-14" />
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-extrabold">وصلنا طلب التسجيل</h1>
            <p className="text-sm text-muted">أهلًا {regFullName.trim()}، بيانات حسابك عند الإدارة دلوقتي.</p>
          </div>
          <ul className="space-y-2 rounded-xl bg-surface2/60 p-4 text-start text-sm">
            <li>تراجع الإدارة بياناتك وتفعّل حسابك.</li>
            <li>بعد التفعيل تدخل باسم المستخدم <span dir="ltr" className="font-bold text-primary">{username.trim()}</span> وكلمة المرور اللي كتبتها.</li>
            <li>لو اتأخر التفعيل، كلّم الإدارة وقولهم اسم المستخدم.</li>
          </ul>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => { setP(""); setRegConfirmPassword(""); switchTab("login"); }}
          >
            الرجوع لتسجيل الدخول
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="blob-a absolute -start-32 -top-32 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="blob-b absolute -bottom-32 -end-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        className="card relative w-full max-w-sm space-y-4 p-6"
      >
        {/* Brand */}
        <div className="space-y-1 text-center">
          <h1 className="flex justify-center">
            <Logo className="h-20" />
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex items-center p-1 bg-surface2/60 border border-line/10 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => switchTab("login")}
            className={`flex-1 px-3 py-2 rounded-lg transition ${tab === "login" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"}`}
          >
            دخول
          </button>
          <button
            type="button"
            onClick={() => switchTab("forgot")}
            className={`flex-1 px-3 py-2 rounded-lg transition ${tab === "forgot" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"}`}
          >
            نسيت المرور؟
          </button>
          <button
            type="button"
            onClick={() => switchTab("register")}
            className={`flex-1 px-3 py-2 rounded-lg transition ${tab === "register" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"}`}
          >
            حساب جديد
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-center text-sm text-muted">
          {tab === "login" && "سجّل الدخول لمتابعة الطلبات"}
          {tab === "forgot" && "اكتب اسم المستخدم وسيراجع الأدمن طلبك"}
          {tab === "register" && "أنشئ حساب جديد — سيتم مراجعة طلبك من قبل الإدارة"}
        </p>

        {/* Username (all tabs) */}
        <label className="block space-y-1 text-sm">
          <span className="text-muted">اسم المستخدم</span>
          <input
            className="input"
            dir="ltr"
            autoComplete="username"
            value={username}
            onChange={(e) => setU(e.target.value)}
            required
            minLength={3}
          />
        </label>

        {/* Register-only fields */}
        {tab === "register" && (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">الاسم الكامل</span>
              <input
                className="input"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                required
                minLength={2}
                placeholder="مثال: أحمد محمد للتجارة"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">رقم الهاتف (اختياري)</span>
              <input
                className="input"
                dir="ltr"
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                placeholder="مثال: 01012345678"
              />
            </label>
          </>
        )}

        {/* Password (login + register) */}
        {(tab === "login" || tab === "register") && (
          <label className="block space-y-1 text-sm">
            <span className="text-muted">كلمة المرور{tab === "register" && " (12 حرفاً على الأقل)"}</span>
            <input
              className="input"
              dir="ltr"
              type="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setP(e.target.value)}
              required
              minLength={tab === "register" ? 12 : 1}
            />
          </label>
        )}

        {/* Confirm password (register only) */}
        {tab === "register" && (
          <label className="block space-y-1 text-sm">
            <span className="text-muted">تأكيد كلمة المرور</span>
            <input
              className="input"
              dir="ltr"
              type="password"
              autoComplete="new-password"
              value={regConfirmPassword}
              onChange={(e) => setRegConfirmPassword(e.target.value)}
              required
            />
          </label>
        )}

        {/* Error & success messages */}
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        {sent && tab === "forgot" && (
          <p role="status" className="text-sm text-success">
            تم إرسال الطلب. سيتواصل معك الأدمن لإعادة تعيين كلمة المرور.
          </p>
        )}
        {sent && tab === "register" && (
          <p role="status" className="text-sm text-success">
            ✓ تم إرسال طلب التسجيل بنجاح. سيتم مراجعة حسابك وتفعيله من قبل الإدارة قريباً.
          </p>
        )}

        {/* Submit button */}
        <button className="btn-primary w-full" aria-busy={busy} disabled={busy || (sent && tab !== "login")}>
          <BtnLabel loading={busy}>
            {tab === "login" ? "دخول" : tab === "forgot" ? "إرسال الطلب" : "إرسال طلب التسجيل"}
          </BtnLabel>
        </button>
      </motion.form>
    </div>
  );
}
