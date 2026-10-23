import { motion } from "framer-motion";
import { ClipboardList, Home, LayoutGrid, Moon, ShoppingCart, Sun, User, Wallet } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { cartCount, useCart } from "../store/cart";
import { useUI } from "../store/ui";
import CartDrawer from "./CartDrawer";
import Logo from "./Logo";
import { InstallBanner } from "./PWAPrompts";

const NAV = [
  { to: "/", label: "الرئيسية", icon: Home, end: true },
  { to: "/catalog", label: "المنتجات", icon: LayoutGrid, end: false },
  { to: "/orders", label: "طلباتي", icon: ClipboardList, end: false },
  { to: "/account", label: "حسابي", icon: Wallet, end: false },
  { to: "/profile", label: "ملفي", icon: User, end: false },
];

export default function Layout() {
  const { pathname } = useLocation();
  const count = useCart((s) => cartCount(s.items));
  const setOpen = useCart((s) => s.setOpen);
  const { theme, toggleTheme } = useUI();
  const role = useAuth((s) => s.user?.role);

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line/10 bg-bg/80 backdrop-blur-lg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <NavLink to="/" aria-label="Turk-pen" className="shrink-0">
            <Logo className="h-10" />
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `rounded-lg px-4 py-2 text-sm font-medium transition ${isActive ? "bg-primary/15 text-primary" : "text-muted hover:text-ink"}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {role && role !== "distributor" && (
              <NavLink to="/admin" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-primary md:inline">لوحة الأدمن</NavLink>
            )}
            <button aria-label="تغيير المظهر" onClick={toggleTheme} className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-line/5 hover:text-ink">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button aria-label="السلة" onClick={() => setOpen(true)} className="relative grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary hover:bg-primary/25">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </motion.span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Outlet />
        </motion.div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line/10 bg-bg/95 md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.end} className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${isActive ? "text-primary" : "text-muted"}`}>
                <n.icon className="h-5 w-5" /> {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <CartDrawer />
      <InstallBanner />
    </div>
  );
}
