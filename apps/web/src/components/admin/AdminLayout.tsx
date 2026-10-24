import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Boxes, Building2, ClipboardList, FolderTree, LayoutDashboard, LogOut, Menu, Moon, Package, Percent, Settings, Shield, Sparkles, Store, Sun, Tag, Users, Wallet, Warehouse as WarehouseIcon, X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { api } from "../../lib/api";
import { useAuth } from "../../store/auth";
import { useCart } from "../../store/cart";
import { useUI } from "../../store/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminDashboard } from "../../hooks/adminQueries";
import { NotificationBell } from "../SSEProvider";
import Logo from "../Logo";

const NAV = [
  { to: "/admin", label: "لوحة التحكم", icon: LayoutDashboard, end: true, badgeKey: null },
  { to: "/admin/orders", label: "الطلبات", icon: ClipboardList, end: false, badgeKey: "newOrdersCount" },
  { to: "/admin/products", label: "المنتجات", icon: Package, end: false, badgeKey: null },
  { to: "/admin/categories", label: "التصنيفات", icon: FolderTree, end: false, badgeKey: null },
  { to: "/admin/warehouses", label: "المخازن", icon: WarehouseIcon, end: false, badgeKey: null },
  { to: "/admin/stock", label: "المخزون", icon: Boxes, end: false, badgeKey: null },
  { to: "/admin/purchases", label: "المشتريات", icon: Package, end: false, badgeKey: null },
  { to: "/admin/users", label: "المستخدمون", icon: Users, end: false, badgeKey: "pendingRegistrations" },
  { to: "/admin/discounts", label: "الخصومات", icon: Percent, end: false, badgeKey: null },
  { to: "/admin/password-requests", label: "طلبات الباسورد", icon: Shield, end: false, badgeKey: "pendingPasswordRequests" },
  { to: "/admin/reports", label: "التقارير", icon: Tag, end: false, badgeKey: null },
  { to: "/admin/accounts", label: "حسابات الموزعين", icon: Wallet, end: false, badgeKey: null },
  { to: "/admin/settings", label: "إعدادات الطلبات والوحدات", icon: Settings, end: false, badgeKey: null },
  { to: "/admin/company", label: "بيانات المنشأة", icon: Building2, end: false, badgeKey: null },
] as const;

type BadgeKey = "newOrdersCount" | "pendingRegistrations" | "pendingPasswordRequests";

const BADGE_COLORS: Record<BadgeKey, string> = {
  newOrdersCount: "bg-danger",
  pendingRegistrations: "bg-primary",
  pendingPasswordRequests: "bg-accent",
};

export default function AdminLayout() {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useUI();
  const user = useAuth((s) => s.user)!;
  const clearAuth = useAuth((s) => s.clear);
  const clearCart = useCart((s) => s.clear);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);


  // Fetch dashboard counts for badges (silently in background)
  const isSuperAdmin = user.role === "super_admin";
  const { data: dashData } = useAdminDashboard(isSuperAdmin);
  const badgeCounts: Record<BadgeKey, number> = {
    newOrdersCount: dashData?.stats.newOrdersCount ?? 0,
    pendingRegistrations: dashData?.stats.pendingRegistrations ?? 0,
    pendingPasswordRequests: dashData?.stats.pendingPasswordRequests ?? 0,
  };

  async function logout() {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    clearCart(); qc.clear(); clearAuth(); nav("/login", { replace: true });
  }

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 z-30 hidden h-dvh w-64 shrink-0 flex-col border-e border-line/10 bg-surface/80 print:hidden md:flex">
        <div className="px-5 py-5">
          <Logo className="h-10" />
          <p className="mt-3 font-display text-sm font-bold text-primary">لوحة الأدمن</p>
          <p className="mt-1 truncate text-xs text-muted">{user.fullName}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {(isSuperAdmin ? NAV : NAV.filter((n) => n.to === "/admin/orders" || n.to === "/admin/settings")).map((n) => {
            const count = n.badgeKey ? (badgeCounts[n.badgeKey as BadgeKey] ?? 0) : 0;
            return (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium ${isActive ? "bg-primary/15 text-primary" : "text-muted hover:bg-line/5 hover:text-ink"}`}>
                <n.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{n.label}</span>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white ${BADGE_COLORS[n.badgeKey as BadgeKey]}`}
                  >
                    {count > 99 ? "99+" : count}
                  </motion.span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="space-y-1 border-t border-line/10 p-3">
          <NavLink to="/" className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:text-ink">
            <Store className="h-4 w-4" /> واجهة الموزع
          </NavLink>
          <button type="button" onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-danger hover:bg-danger/10">
            <LogOut className="h-4 w-4" /> خروج
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-line/10 bg-bg/80 backdrop-blur-lg print:hidden" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="flex h-16 items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2 md:hidden">
              <button type="button" aria-label="القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="relative grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-line/5">
                <Menu className="h-6 w-6" />
                {Object.values(badgeCounts).some((c) => c > 0) && <span className="absolute end-2 top-2 h-2.5 w-2.5 rounded-full bg-danger" />}
              </button>
              <Logo className="h-8" />
            </div>
            <div className="ms-auto flex items-center gap-2">
              <button type="button" aria-label="فتح المساعد الذكي" title="المساعد الذكي" onClick={() => window.dispatchEvent(new Event("assistant:toggle"))} className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-primary/10 hover:text-primary"><Sparkles className="h-5 w-5" /></button>
              <NotificationBell />
              <button aria-label="تغيير المظهر" onClick={toggleTheme} className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-line/5">
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </header>
        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div key="bd" className="fixed inset-0 z-40 bg-black/60 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
              <motion.aside
                key="sheet" role="dialog" aria-modal aria-label="قائمة الأدمن"
                className="fixed inset-y-0 start-0 z-50 flex w-72 max-w-[85vw] flex-col bg-bg shadow-soft md:hidden"
                initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                transition={{ type: "spring", stiffness: 320, damping: 34 }}
              >
                <div className="flex items-start justify-between px-5 pb-3" style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}>
                  <div>
                    <Logo className="h-9" />
                    <p className="mt-2 truncate text-xs text-muted">{user.fullName}</p>
                  </div>
                  <button type="button" aria-label="إغلاق" onClick={() => setMenuOpen(false)} className="grid h-11 w-11 place-items-center rounded-lg hover:bg-line/5"><X className="h-5 w-5" /></button>
                </div>
                <nav className="flex-1 space-y-1 overflow-y-auto px-3">
                  {(isSuperAdmin ? NAV : NAV.filter((n) => n.to === "/admin/orders" || n.to === "/admin/settings")).map((n) => {
                    const count = n.badgeKey ? (badgeCounts[n.badgeKey as BadgeKey] ?? 0) : 0;
                    return (
                      <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) =>
                        `flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium ${isActive ? "bg-primary/15 text-primary" : "text-muted hover:bg-line/5 hover:text-ink"}`}>
                        <n.icon className="h-5 w-5 shrink-0" />
                        <span className="flex-1">{n.label}</span>
                        {count > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white ${BADGE_COLORS[n.badgeKey as BadgeKey]}`}>{count > 99 ? "99+" : count}</span>}
                      </NavLink>
                    );
                  })}
                </nav>
                <div className="space-y-1 border-t border-line/10 p-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
                  <NavLink to="/" className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm text-muted hover:text-ink"><Store className="h-5 w-5" /> واجهة الموزع</NavLink>
                  <button type="button" onClick={logout} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm text-danger hover:bg-danger/10"><LogOut className="h-5 w-5" /> خروج</button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
        <main className="mx-auto max-w-7xl px-4 py-6">
          <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
