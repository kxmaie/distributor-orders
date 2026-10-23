import { MotionConfig } from "framer-motion";
import { lazy, Suspense, useEffect, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
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
  if (user.role === "distributor") return <Navigate to="/" replace />;
  return children;
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
                <Route index element={<Home />} />
                <Route path="catalog" element={<Catalog />} />
                <Route path="products/:id" element={<ProductDetails />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="orders" element={<Orders />} />
                <Route path="orders/:id" element={<OrderDetails />} />
                <Route path="profile" element={<Profile />} />
                <Route path="account" element={<Account />} />
              </Route>
              <Route path="/admin" element={<RequireAuth><RequireAdmin><AdminLayout /></RequireAdmin></RequireAuth>}>
                <Route index element={<AdminDashboard />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="orders/:id" element={<AdminOrderDetails />} />
                <Route path="stock" element={<AdminStock />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="products/:id" element={<AdminProductEdit />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="warehouses" element={<AdminWarehouses />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="discounts" element={<AdminDiscounts />} />
                <Route path="password-requests" element={<AdminPasswordRequests />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="accounts" element={<AdminAccounts />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Boot>
        {/* SSE connection — mounts for any authenticated user */}
        <SSEProvider />
        <Toasts />
        <OfflineBanner />
        <UpdatePrompt />
      </BrowserRouter>
    </MotionConfig>
  );
}
