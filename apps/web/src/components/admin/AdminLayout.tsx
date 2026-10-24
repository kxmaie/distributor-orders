import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Boxes, Building2, ClipboardList, FolderTree, History, LayoutDashboard, LogOut, Menu, Moon, Package, Percent, Settings, Shield, Sparkles, Store, Sun, Users, Wallet, Warehouse as WarehouseIcon, X, ReceiptText, TrendingUp, ShoppingBag, RotateCcw,
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

const NAV_GROUPS = [
  { key:"home",label:"الرئيسية",icon:LayoutDashboard,items:[{to:"/admin",label:"لوحة التحكم",icon:LayoutDashboard,end:true}] },
  { key:"orders",label:"الطلبات",icon:ClipboardList,items:[{to:"/admin/orders",label:"إدارة الطلبات",icon:ClipboardList,badgeKey:"newOrdersCount"}] },
  { key:"sales",label:"المبيعات",icon:ReceiptText,items:[{to:"/admin/sales",label:"فواتير المبيعات",icon:ReceiptText,end:true},{to:"/admin/sales/returns",label:"مرتجعات المبيعات",icon:RotateCcw,superAdminOnly:true}] },
  { key:"purchases",label:"المشتريات",icon:Package,superAdminOnly:true,items:[{to:"/admin/purchases",label:"فواتير المشتريات",icon:Package,end:true},{to:"/admin/purchases/returns",label:"مرتجعات المشتريات",icon:RotateCcw}] },
  { key:"inventory",label:"المخزون",icon:Boxes,superAdminOnly:true,items:[{to:"/admin/stock",label:"المخزون الحالي",icon:Boxes,end:true},{to:"/admin/stock/movements",label:"حركة الصنف التفصيلية",icon:Boxes}] },
  { key:"accounting",label:"المحاسبة",icon:Wallet,superAdminOnly:true,items:[{to:"/admin/accounting",label:"شجرة الحسابات والسندات",icon:Wallet}] },
  { key:"reports",label:"التقارير",icon:TrendingUp,superAdminOnly:true,items:[{to:"/admin/reports/sales",label:"تقارير المبيعات",icon:ReceiptText},{to:"/admin/reports/returns/sales",label:"مرتجعات المبيعات",icon:RotateCcw},{to:"/admin/reports/purchases",label:"تقارير المشتريات",icon:Package},{to:"/admin/reports/returns/purchases",label:"مرتجعات المشتريات",icon:RotateCcw},{to:"/admin/reports/products",label:"تقارير المنتجات",icon:ShoppingBag},{to:"/admin/reports/inventory",label:"تقارير المخزون",icon:Boxes},{to:"/admin/reports/accounting",label:"تقارير المحاسبة",icon:Wallet}] },
  { key:"settings",label:"إعدادات الطلبات والوحدات",icon:Settings,items:[{to:"/admin/settings",label:"إعدادات الطلبات والوحدات",icon:Settings}] },
  { key:"management",label:"الإدارة",icon:Settings,superAdminOnly:true,items:[{to:"/admin/products",label:"المنتجات",icon:Package},{to:"/admin/categories",label:"التصنيفات",icon:FolderTree},{to:"/admin/warehouses",label:"المخازن",icon:WarehouseIcon},{to:"/admin/users",label:"المستخدمون",icon:Users,badgeKey:"pendingRegistrations"},{to:"/admin/discounts",label:"الخصومات",icon:Percent},{to:"/admin/password-requests",label:"طلبات الباسورد",icon:Shield,badgeKey:"pendingPasswordRequests"},{to:"/admin/accounts",label:"حسابات الموزعين",icon:Wallet},{to:"/admin/audit",label:"سجل التغييرات",icon:History},{to:"/admin/company",label:"بيانات المنشأة",icon:Building2}] },
] as const;

type BadgeKey = "newOrdersCount" | "pendingRegistrations" | "pendingPasswordRequests";
const BADGE_COLORS: Record<BadgeKey, string> = { newOrdersCount: "bg-danger", pendingRegistrations: "bg-primary", pendingPasswordRequests: "bg-accent" };
function AdminNav({isSuperAdmin,badgeCounts,onNavigate}:{isSuperAdmin:boolean;badgeCounts:Record<BadgeKey,number>;onNavigate?:()=>void}) {
 const location=useLocation();const activeGroup=NAV_GROUPS.find(g=>g.items.some(item=>location.pathname===item.to||(item.to!=="/admin"&&location.pathname.startsWith(item.to+"/"))))?.key??null;const [open,setOpen]=useState<string|null>(activeGroup);
 useEffect(()=>{if(activeGroup)setOpen(activeGroup)},[activeGroup]);
 return <div className="space-y-1">{NAV_GROUPS.filter(g=>isSuperAdmin||!("superAdminOnly" in g&&g.superAdminOnly)).map(group=>{
  const visible=group.items.filter(item=>isSuperAdmin||!("superAdminOnly" in item&&item.superAdminOnly));if(!visible.length)return null;
  if(visible.length===1)return <NavLink key={group.key} to={visible[0].to} end={"end" in visible[0]?visible[0].end:false} onClick={onNavigate} className={({isActive})=>`group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl border px-3 text-sm font-semibold transition-all duration-200 ${isActive?"border-primary/20 bg-gradient-to-l from-primary/15 to-primary/5 text-primary shadow-sm shadow-primary/5":"border-transparent text-muted hover:-translate-x-0.5 hover:border-line/10 hover:bg-line/5 hover:text-ink"}`}><motion.span whileHover={{scale:1.12,rotate:-5}} transition={{type:"spring",stiffness:420,damping:18}} className="grid shrink-0 place-items-center"><group.icon className="h-4 w-4"/></motion.span><span className="flex-1">{group.label}</span></NavLink>;
  const expanded=open===group.key;return <div key={group.key}><button type="button" aria-expanded={expanded} onClick={()=>setOpen(expanded?null:group.key)} className={`group relative flex min-h-11 w-full items-center gap-3 overflow-hidden rounded-xl border px-3 text-sm font-semibold transition-all duration-200 ${expanded||activeGroup===group.key?"border-primary/20 bg-gradient-to-l from-primary/15 to-primary/5 text-primary shadow-sm shadow-primary/5":"border-transparent text-muted hover:-translate-x-0.5 hover:border-line/10 hover:bg-line/5 hover:text-ink"}`}><motion.span whileHover={{scale:1.12,rotate:-5}} transition={{type:"spring",stiffness:420,damping:18}} className="grid shrink-0 place-items-center"><group.icon className="h-4 w-4"/></motion.span><span className="flex-1 text-start">{group.label}</span><motion.span animate={{rotate:expanded?180:0}} transition={{duration:.18}} className="text-xs">⌄</motion.span></button><AnimatePresence initial={false}><motion.div key="children" initial={{height:0,opacity:0}} animate={{height:expanded?"auto":0,opacity:expanded?1:0}} exit={{height:0,opacity:0}} transition={{duration:.2,ease:"easeInOut"}} className="overflow-hidden"><div className="ms-4 space-y-1 border-s border-line/15 py-1 ps-2">{visible.map(item=>{const badgeKey=(item as {badgeKey?:BadgeKey}).badgeKey;const count=badgeKey?badgeCounts[badgeKey]:0;return <NavLink key={item.to} to={item.to} end={"end" in item?item.end:false} onClick={onNavigate} className={({isActive})=>`group flex min-h-10 items-center gap-2 rounded-lg border border-transparent px-3 text-sm transition-all duration-200 ${isActive?"border-primary/15 bg-primary/10 font-semibold text-primary":"text-muted hover:-translate-x-0.5 hover:bg-line/5 hover:text-ink"}`}><item.icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3"/><span className="flex-1">{item.label}</span>{count>0&&<span className={`rounded-full px-1.5 py-0.5 text-[10px] text-white ${BADGE_COLORS[badgeKey!]}`}>{count>99?"99+":count}</span>}</NavLink>})}</div></motion.div></AnimatePresence></div>;
 })}</div>;
}

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
      <aside className="sticky top-0 z-30 hidden h-dvh w-64 shrink-0 flex-col border-e border-primary/10 bg-gradient-to-b from-surface via-surface to-primary/5 shadow-[0_0_40px_rgba(13,148,136,0.04)] print:hidden md:flex">
        <div className="px-5 py-5">
          <Logo className="h-10" />
          <p className="mt-3 font-display text-sm font-bold text-primary">لوحة الأدمن</p>
          <p className="mt-1 truncate text-xs text-muted">{user.fullName}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3"><AdminNav isSuperAdmin={isSuperAdmin} badgeCounts={badgeCounts} /></nav>
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
                <nav className="flex-1 space-y-1 overflow-y-auto px-3"><AdminNav isSuperAdmin={isSuperAdmin} badgeCounts={badgeCounts} onNavigate={() => setMenuOpen(false)} /></nav>
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
