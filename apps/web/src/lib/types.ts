import type { OrderStatus } from "@do/shared";

export type Role = "distributor" | "supplier" | "admin" | "super_admin";
export type User = { id: string; username: string; fullName: string; phone: string | null; whatsappOptInAt: string | null; role: Role };

export type Category = { id: number; name: string; slug: string; sortOrder: number };
export type Variant = { id: string; sku: string; label: string; price: string; yourPrice: string; available: number; inStock: boolean };
export type Product = {
  id: string; name: string; description: string | null; imageUrl: string | null;
  unit: string; unitLabel: string; piecesPerUnit: number; basePrice: string;
  category: { id: number; name: string; slug: string };
  variants: Variant[];
};
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type PricedLine = {
  variantId: string; sku: string; productName: string; variantLabel: string;
  unitPrice: string; discountPct: string; qty: number; lineTotal: string;
};
export type Shortage = { variantId: string; sku: string; requested: number; available: number };
export type Priced = {
  lines: PricedLine[]; subtotal: string; discountTotal: string; total: string;
  fulfillableWarehouses: { id: number; name: string }[]; shortages: Shortage[];
};

export type OrderUser = { id: string; username: string; fullName: string; phone?: string | null };
export type OrderSummary = {
  id: string; orderNo: string; status: OrderStatus; warehouse: { id: number; name: string };
  itemCount: number; subtotal: string; discountTotal: string; total: string; createdAt: string; updatedAt: string;
  user?: OrderUser;
};
export type OrderDetail = Omit<OrderSummary, "itemCount"> & {
  notes: string | null;
  items: { id: string; variantId: string; productId: string; sku: string; unit: string; piecesPerUnit: number; productName: string; variantLabel: string; unitPrice: string; discountPct: string; qty: number; lineTotal: string }[];
  deliveries: { id: string; trackingNumber: string | null; note: string | null; deliveredAt: string; amount: string; items: { orderItemId: string; qty: number; amount: string }[] }[];
  history: { fromStatus: string | null; toStatus: OrderStatus; createdAt: string; changedBy?: string; note?: string | null }[];
};

export type AccountStatement = {
  user: { id: string; fullName: string; username: string };
  openingBalance: string;
  balance: string;
  rows: { id: string; date: string; type: "delivery" | "payment"; reference: string; description: string; debit: string; credit: string; balance: string }[];
};

export type AdminUser = {
  id: string; username: string; fullName: string; phone: string | null; role: Role;
  defaultDiscountPct: string; isActive: boolean; lockedUntil: string | null; createdAt: string; updatedAt: string;
};
export type AdminCategory = { id: number; name: string; slug: string; sortOrder: number; isActive: boolean };
export type StockLevel = {
  variantId: string;
  warehouseId: number;
  onHand: number;
  reserved: number;
  warehouse: { id: number; name: string; isActive?: boolean };
};
export type AdminVariant = {
  id: string;
  productId?: string;
  sku: string;
  label: string;
  priceDelta: string;
  isActive: boolean;
  stockLevels?: StockLevel[];
};
export type AdminProduct = {
  id: string; categoryId: number; name: string; description: string | null; imageUrl: string | null;
  basePrice: string; unit: string; piecesPerUnit: number; isActive: boolean;
  category: { id: number; name: string; slug: string };
  variants: AdminVariant[];
};
export type Warehouse = { id: number; name: string; isActive: boolean };
export type StockRow = {
  variantId: string; warehouseId: number; onHand: number; reserved: number; available: number; lowStockThreshold: number;
  variant: { sku: string; label: string; product: { id: string; name: string } };
  warehouse: { id: number; name: string };
};
export type StockAlert = {
  variantId: string; warehouseId: number; warehouse: { id: number; name: string };
  productId: string; productName: string; categoryName: string; sku: string; label: string;
  available: number; threshold: number;
  alternatives: { id: string; sku: string; label: string; productId: string; productName: string; available: number }[];
};
export type StockMovement = {
  id: string; variantId: string; warehouseId: number; type: string; qty: number; note: string | null; createdAt: string;
};
export type Discount = {
  id: string; userId: string | null; categoryId: number | null; productId: string | null; pct: string;
  startsAt: string | null; endsAt: string | null; isActive: boolean;
  user: { id: string; username: string; fullName: string } | null;
  category: { id: number; name: string } | null;
  product: { id: string; name: string } | null;
};
export type PasswordRequest = {
  id: string; username: string; note: string | null; status: "pending" | "resolved" | "rejected";
  createdAt: string; resolvedAt: string | null;
  user: { id: string; fullName: string; username: string; isActive: boolean } | null;
};

export type { DashboardSummary } from "@do/shared";

