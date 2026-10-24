import { MotionConfig } from "framer-motion";
import { lazy, Suspense, useEffect, type ReactElement } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import AssistantWidget from "./components/AssistantWidget";
import Logo from "./components/Logo";
import AdminLayout from "./components/admin/AdminLayout";
import { OfflineBanner, UpdatePrompt } from "./components/PWAPrompts";
import SSEProvider from "./components/SSEProvider";
import Toasts from "./components/Toasts";
import { Spinner } from "./components/ui";
import { refreshSession } from "./lib/api";
import Catalog from "./pages/Catalog";
import Checkout from "./pages/Checkout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import OrderDetails from "./pages/OrderDetails";
import Orders from "./pages/Orders";
import Account from "./pages/Account";
import ProductDetails from "./pages/ProductDetails";
import Profile from "./pages/Profile";
import { useAuth } from "./store/auth";

const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminOrders = lazy(() => import("./pages/admin/Orders"));
const AdminSales = lazy(() => import("./pages/admin/Sales"));
const AdminOrderDetails = lazy(() => import("./pages/admin/OrderDetails"));
const AdminStock = lazy(() => import("./pages/admin/Stock"));
const AdminProducts = lazy(() => import("./pages/admin/Products"));
const AdminProductEdit = lazy(() => import("./pages/admin/ProductEdit"));
const AdminCategories = lazy(() => import("./pages/admin/Categories"));
const AdminWarehouses = lazy(() => import("./pages/admin/Warehouses"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminDiscounts = lazy(() => import("./pages/admin/Discounts"));
const AdminPasswordRequests = lazy(() => import("./pages/admin/PasswordRequests"));
const AdminReports = lazy(() => import("./pages/admin/Reports"));
const AdminAccounts = lazy(() => import("./pages/admin/Accounts"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminPurchases = lazy(() => import("./pages/admin/Purchases"));
const AdminCompanyProfile = lazy(() => import("./pages/admin/CompanyProfile"));
const AdminReturns = lazy(() => import("./pages/admin/Returns"));
const AdminAccounting = lazy(() => import("./pages/admin/Accounting"));
const AdminPurchasesReport = lazy(() => import("./pages/admin/PurchasesReport"));
const AdminAccountingReport = lazy(() => import("./pages/admin/AccountingReport"));
const AdminOtherReports = lazy(() => import("./pages/admin/OtherReports"));
const AdminItemMovements = lazy(() => import("./pages/admin/ItemMovements"));
const SupplierInventory = lazy(() => import("./pages/SupplierInventory"));

function Boot({ children }: { children: ReactElement }) {
  const status = useAuth((s) => s.status);
  if (status === "loading")
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="flex flex-col items-center gap-6 text-primary">
          <Logo className="h-16" />
          <Spinner />
        </div>
      </div>
    );
  return children;
}

function RequireAuth({ children }: { children: ReactElement }) {
  const status = useAuth((s) => s.status);
  const loc = useLocation();
  if (status === "anon") return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return children;
}

function RequireAdmin({ children }: { children: ReactElement }) {
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (user.role !== "admin" && user.role !== "super_admin") return <Navigate to={user.role === "supplier" ? "/supplier/inventory" : "/"} replace />;
  return children;
}

function RequireBuyer({ children }: { children: ReactElement }) {
  const role = useAuth((s) => s.user?.role);
  return role === "supplier" ? <Navigate to="/supplier/inventory" replace /> : children;
}

function RequireSupplier({ children }: { children: ReactElement }) {
  const role = useAuth((s) => s.user?.role);
  return role === "supplier" ? children : <Navigate to="/" replace />;
}

function RoleHome() {
  const role = useAuth((s) => s.user?.role);
  return role === "supplier" ? <Navigate to="/supplier/inventory" replace /> : <Home />;
}

function AdminIndex() {
  const role = useAuth((s) => s.user?.role);
  return role === "super_admin" ? <AdminDashboard /> : <Navigate to="/admin/orders" replace />;
}

function SuperAdminOnly({ children }: { children: ReactElement }) {
  const role = useAuth((s) => s.user?.role);
  return role === "super_admin" ? children : <Navigate to="/admin/orders" replace />;
}

function Fall() {
  return <div className="grid min-h-[40vh] place-items-center text-primary"><Spinner /></div>;
}

export default function App() {
  useEffect(() => {
    refreshSession().then((ok) => { if (!ok) useAuth.getState().clear(); });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Boot>
          <Suspense fallback={<Fall />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAuth><Layout /></RequireAuth>}>
                <Route index element={<RoleHome />} />
                <Route path="supplier/inventory" element={<RequireSupplier><SupplierInventory /></RequireSupplier>} />
                <Route path="profile" element={<Profile />} />
                <Route element={<RequireBuyer><Outlet /></RequireBuyer>}>
                  <Route path="catalog" element={<Catalog />} />
                  <Route path="products/:id" element={<ProductDetails />} />
                  <Route path="checkout" element={<Checkout />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="orders/:id" element={<OrderDetails />} />
                  <Route path="account" element={<Account />} />
                </Route>
              </Route>
              <Route path="/admin" element={<RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>}>
                <Route index element={<AdminIndex />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="orders/:id" element={<AdminOrderDetails />} />
                <Route path="sales" element={<AdminSales />} />
                <Route path="sales/returns" element={<SuperAdminOnly><AdminReturns kind="sales" /></SuperAdminOnly>} />
                <Route path="sales/:id" element={<AdminOrderDetails />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="company" element={<SuperAdminOnly><AdminCompanyProfile /></SuperAdminOnly>} />
                <Route path="stock" element={<SuperAdminOnly><AdminStock /></SuperAdminOnly>} />
                <Route path="purchases" element={<SuperAdminOnly><AdminPurchases /></SuperAdminOnly>} />
                <Route path="purchases/returns" element={<SuperAdminOnly><AdminReturns kind="purchase" /></SuperAdminOnly>} />
                <Route path="accounting" element={<SuperAdminOnly><AdminAccounting /></SuperAdminOnly>} />
                <Route path="stock/movements" element={<SuperAdminOnly><AdminItemMovements /></SuperAdminOnly>} />
                <Route path="reports/sales" element={<SuperAdminOnly><AdminReports /></SuperAdminOnly>} />
                <Route path="reports/purchases" element={<SuperAdminOnly><AdminPurchasesReport /></SuperAdminOnly>} />
                <Route path="reports/accounting" element={<SuperAdminOnly><AdminAccountingReport /></SuperAdminOnly>} />
                <Route path="reports/other" element={<SuperAdminOnly><AdminOtherReports /></SuperAdminOnly>} />
                <Route path="products" element={<SuperAdminOnly><AdminProducts /></SuperAdminOnly>} />
                <Route path="products/:id" element={<SuperAdminOnly><AdminProductEdit /></SuperAdminOnly>} />
                <Route path="categories" element={<SuperAdminOnly><AdminCategories /></SuperAdminOnly>} />
                <Route path="warehouses" element={<SuperAdminOnly><AdminWarehouses /></SuperAdminOnly>} />
                <Route path="users" element={<SuperAdminOnly><AdminUsers /></SuperAdminOnly>} />
                <Route path="discounts" element={<SuperAdminOnly><AdminDiscounts /></SuperAdminOnly>} />
                <Route path="password-requests" element={<SuperAdminOnly><AdminPasswordRequests /></SuperAdminOnly>} />
                <Route path="reports" element={<SuperAdminOnly><AdminReports /></SuperAdminOnly>} />
                <Route path="accounts" element={<SuperAdminOnly><AdminAccounts /></SuperAdminOnly>} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Boot>
        {/* SSE connection — mounts for any authenticated user */}
        <SSEProvider />
        <AssistantWidget />
        <Toasts />
        <OfflineBanner />
        <UpdatePrompt />
      </BrowserRouter>
    </MotionConfig>
  );
}
