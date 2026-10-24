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
  if (status === "anon") return <Navigate to="/login" replace state={{ from: lo