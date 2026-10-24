import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Boxes, Building2, ClipboardList, FolderTree, LayoutDashboard, LogOut, Menu, Moon, Package, Percent, Settings, Shield, Sparkles, Store, Sun, Tag, Users, Wallet, Warehouse as WarehouseIcon, X, ReceiptText,
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
  { key:"sales",label:"المبيعات",icon:ReceiptText,items:[{to:"/admin/sales",label:"فواتير المبيعات",icon:ReceiptText,end:true},{to:"/admin/sales/returns",label:"مرتجعات المبيعات",icon:ReceiptText,superAdminOnly:true}] },
  { key:"purchases",label:"المشتريات",icon:Package,superAdminOnly:true,items:[{to:"/admin/purchases",label:"فواتير المشتريات",icon:Package,end:true},{to:"/admin/purchases/returns",label:"مرتجعات المشتريات",icon:Package}] },
  { key:"inventory",label:"المخزون",icon:Boxes,superAdminOnly:true,items:[{to:"/admin/stock",label:"المخزون الحالي",icon:Boxes,end:true},{to:"/admin/stock/movements",label:"حركة الصنف التفصيلية",icon:Boxes}] },
  { key:"accounting",label:"المحاسبة",icon:Wallet,superAdminOnly:true,items:[{to:"/admin/accounting",label:"شجرة الحسابات والسندات",icon:Wallet}] },
  { key:"reports",label:"التقارير",icon:Tag,superAdminOnly:true,items:[{to:"/admin/reports/sales",label:"تقارير المبيعات",icon:Tag},{to:"/admin/reports/purchases",label:"تقارير المشتريات",icon:Tag},{to:"/admin/reports/accounting",label:"تقارير المحاسبة",icon:Tag},{to:"/admin/reports/other",label:"تقارير أخرى",icon:Tag}] },
  { key:"settings",label:"إعدادات الطلبات والوحدات",icon:Settings,items:[{to:"/admin/settings",label:"إعدادات الطلبات والوحدات",icon:Settings}] },
  { key:"management",label:"الإدارة",icon:Settings,superAdminOnly:true,items:[{to:"/admin/products",label:"المنتجات",icon:Package},{to:"/admin/categories",label:"التصنيفات",icon:FolderTree},{to:"/admin/warehouses",label:"المخازن",icon:WarehouseIcon},{to:"/admin/users",label:"المستخدمون",icon:Users,badgeKey:"pendingRegistrations"},{to:"/admin/discounts",label:"الخصومات",icon:Percent},{to:"/admin/password-requests",label:"طلبات الباسورد",icon:Shield,badgeKey:"pendingPasswordRequests"},{to:"/admin/accounts",label:"حسابات الموزعين",icon:Wallet},{to:"/admin/company",label:"بيانات المنشأة",icon:Building2}] },
] as const;

type BadgeKey = "newOrdersCount" | "pendingRegistrations" | "pendingPasswordRequests";
const BADGE_COLORS: Record<