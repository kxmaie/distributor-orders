import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  AdminCategory,
  AdminProduct,
  AdminUser,
  AdminVariant,
  DashboardSummary,
  Discount,
  OrderDetail,
  OrderSummary,
  Page,
  PasswordRequest,
  StockMovement,
  StockAlert,
  StockRow,
  Warehouse,
} from "../lib/types";

// ----------------- Dashboard -----------------
export const useAdminDashboard = () =>
  useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: () => api.get<DashboardSummary>("/admin/reports/dashboard"),
    refetchInterval: 30_000,
  });

// ----------------- Orders -----------------
export const useAdminOrders = (params: {
  status?: string;
  q?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) =>
  useQuery({
    queryKey: ["admin", "orders", params],
    queryFn: () =>
      api.get<Page<OrderSummary>>("/admin/orders", {
        status: params.status === "all" ? undefined : params.status,
        q: params.q,
        userId: params.userId,
        from: params.from,
        to: params.to,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 15,
      }),
    placeholderData: keepPreviousData,
  });

export const useAdminOrderDetail = (id: string | null) =>
  useQuery({
    queryKey: ["admin", "order", id],
    queryFn: () => api.get<OrderDetail>(`/admin/orders/${id}`),
    enabled: !!id,
  });

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch<OrderDetail>(`/admin/orders/${id}/status`, { status, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      qc.invalidateQueries({ queryKey: ["admin", "order"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin", "stock"] });
    },
  });
}

// ----------------- Stock -----------------
export const useAdminStock = (params: { warehouseId?: number; q?: string; page?: number; pageSize?: number }) =>
  useQuery({
    queryKey: ["admin", "stock", params],
    queryFn: () =>
      api.get<Page<StockRow>>("/admin/stock", {
        warehouseId: params.warehouseId,
        q: params.q,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 15,
      }),
    placeholderData: keepPreviousData,
  });

export const useAdminStockAlerts = () => useQuery({
  queryKey: ["admin", "stock-alerts"],
  queryFn: () => api.get<StockAlert[]>("/admin/stock/alerts"),
  refetchInterval: 60_000,
});

export function useSetStockThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { variantId: string; warehouseId: number; threshold: number }) => api.patch("/admin/stock/threshold", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "stock"] }); qc.invalidateQueries({ queryKey: ["admin", "stock-alerts"] }); },
  });
}

export const useAdminMovements = (params: { warehouseId?: number; variantId?: string; type?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "movements", params],
    queryFn: () =>
      api.get<Page<StockMovement>>("/admin/stock/movements", {
        warehouseId: params.warehouseId,
        variantId: params.variantId,
        type: params.type === "all" ? undefined : params.type,
        page: params.page ?? 1,
        pageSize: 15,
      }),
    placeholderData: keepPreviousData,
  });

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { variantId: string; warehouseId: number; delta: number; type: "receipt" | "adjustment"; note?: string }) =>
      api.post("/admin/stock/adjust", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "stock"] });
      qc.invalidateQueries({ queryKey: ["admin", "movements"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-product"] });
    },
  });
}

export function useEnsureVariantStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) => api.post(`/admin/variants/${variantId}/ensure-stock`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "stock"] });
      qc.invalidateQueries({ queryKey: ["admin-product"] });
    },
  });
}

// ----------------- Catalog -----------------
export const useAdminCatalogCategories = () =>
  useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => api.get<AdminCategory[]>("/admin/categories"),
  });

export const useAdminCatalogProducts = (params: { category?: string; q?: string; active?: string; page?: number; pageSize?: number }) =>
  useQuery({
    queryKey: ["admin", "products", params],
    queryFn: () =>
      api.get<Page<AdminProduct>>("/admin/products", {
        category: params.category,
        q: params.q,
        active: params.active,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 12,
      }),
    placeholderData: keepPreviousData,
  });

export const useAdminWarehouses = () =>
  useQuery({
    queryKey: ["admin", "warehouses"],
    queryFn: () => api.get<Warehouse[]>("/admin/warehouses"),
  });

export function useCatalogMutations() {
  const qc = useQueryClient();
  const invalidateCatalog = () => {
    qc.invalidateQueries({ queryKey: ["admin", "products"] });
    qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    qc.invalidateQueries({ queryKey: ["admin", "warehouses"] });
    qc.invalidateQueries({ queryKey: ["admin", "stock"] });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["admin-cats"] });
    qc.invalidateQueries({ queryKey: ["admin-product"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const createProduct = useMutation({
    mutationFn: (b: {
      categoryId: number;
      name: string;
      description?: string | null;
      imageUrl?: string | null;
      basePrice: string;
      unit: string;
      warehouseId?: number;
      initialStock?: number;
      sku?: string;
      variantLabel?: string;
    }) => api.post<AdminProduct>("/admin/products", b),
    onSuccess: invalidateCatalog,
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, ...b }: { id: string; categoryId?: number; name?: string; description?: string | null; imageUrl?: string | null; basePrice?: string; unit?: string; isActive?: boolean }) =>
      api.patch<AdminProduct>(`/admin/products/${id}`, b),
    onSuccess: invalidateCatalog,
  });

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.del(`/admin/products/${id}`),
    onSuccess: invalidateCatalog,
  });

  const hardDeleteProduct = useMutation({
    mutationFn: (id: string) => api.del(`/admin/products/${id}/force`),
    onSuccess: invalidateCatalog,
  });

  const createVariant = useMutation({
    mutationFn: (b: {
      productId: string;
      sku?: string;
      label: string;
      priceDelta?: string;
      warehouseId?: number;
      initialStock?: number;
    }) => api.post<AdminVariant>("/admin/variants", b),
    onSuccess: invalidateCatalog,
  });

  const updateVariant = useMutation({
    mutationFn: ({ id, ...b }: { id: string; sku?: string; label?: string; priceDelta?: string; isActive?: boolean }) =>
      api.patch<AdminVariant>(`/admin/variants/${id}`, b),
    onSuccess: invalidateCatalog,
  });

  const deleteVariant = useMutation({
    mutationFn: (id: string) => api.del(`/admin/variants/${id}`),
    onSuccess: invalidateCatalog,
  });

  const createCategory = useMutation({
    mutationFn: (b: { name: string; slug?: string; sortOrder?: number }) => api.post<AdminCategory>("/admin/categories", b),
    onSuccess: invalidateCatalog,
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, ...b }: { id: number; name?: string; slug?: string; sortOrder?: number; isActive?: boolean }) =>
      api.patch<AdminCategory>(`/admin/categories/${id}`, b),
    onSuccess: invalidateCatalog,
  });

  const deleteCategory = useMutation({
    mutationFn: (id: number) => api.del(`/admin/categories/${id}`),
    onSuccess: invalidateCatalog,
  });

  const hardDeleteCategory = useMutation({
    mutationFn: (id: number) => api.del(`/admin/categories/${id}/force`),
    onSuccess: invalidateCatalog,
  });

  const createWarehouse = useMutation({
    mutationFn: (b: { name: string }) => api.post<Warehouse>("/admin/warehouses", b),
    onSuccess: invalidateCatalog,
  });

  const updateWarehouse = useMutation({
    mutationFn: ({ id, ...b }: { id: number; name?: string; isActive?: boolean }) =>
      api.patch<Warehouse>(`/admin/warehouses/${id}`, b),
    onSuccess: invalidateCatalog,
  });

  const deleteWarehouse = useMutation({
    mutationFn: (id: number) => api.del(`/admin/warehouses/${id}`),
    onSuccess: invalidateCatalog,
  });

  const hardDeleteWarehouse = useMutation({
    mutationFn: (id: number) => api.del(`/admin/warehouses/${id}/force`),
    onSuccess: invalidateCatalog,
  });

  return {
    createProduct,
    updateProduct,
    deleteProduct,
    hardDeleteProduct,
    createVariant,
    updateVariant,
    deleteVariant,
    createCategory,
    updateCategory,
    deleteCategory,
    hardDeleteCategory,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    hardDeleteWarehouse,
  };
}

// ----------------- Users -----------------
export const useAdminUsers = (params: { role?: string; q?: string; active?: string; page?: number; pageSize?: number }) =>
  useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () =>
      api.get<Page<AdminUser>>("/admin/users", {
        role: params.role === "all" ? undefined : params.role,
        q: params.q,
        active: params.active,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 15,
      }),
    placeholderData: keepPreviousData,
  });

export const useAdminPendingUsers = (params: { q?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "users", "pending", params],
    queryFn: () =>
      api.get<Page<AdminUser>>("/admin/users/pending", {
        q: params.q,
        page: params.page ?? 1,
        pageSize: 15,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000, // auto-refresh every minute
  });

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidateUsers = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const createUser = useMutation({
    mutationFn: (b: { username: string; password: string; fullName: string; phone?: string | null; role: string; defaultDiscountPct: string }) =>
      api.post<AdminUser>("/admin/users", b),
    onSuccess: invalidateUsers,
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...b }: { id: string; fullName?: string; phone?: string | null; role?: string; defaultDiscountPct?: string; isActive?: boolean; password?: string; unlock?: boolean }) =>
      api.patch<AdminUser>(`/admin/users/${id}`, b),
    onSuccess: invalidateUsers,
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.del(`/admin/users/${id}`),
    onSuccess: invalidateUsers,
  });

  return { createUser, updateUser, deleteUser };
}

export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, defaultDiscountPct }: { id: string; defaultDiscountPct?: string }) =>
      api.post(`/admin/users/${id}/approve`, { defaultDiscountPct }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}

export function useRejectUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/reject`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}

export const useAdminPasswordRequests = (params: { status?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "password-requests", params],
    queryFn: () =>
      api.get<Page<PasswordRequest>>("/admin/password-requests", {
        status: params.status === "all" ? undefined : params.status,
        page: params.page ?? 1,
        pageSize: 15,
      }),
    placeholderData: keepPreviousData,
  });

export function useResolvePasswordRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, newPassword }: { id: string; status: "resolved" | "rejected"; newPassword?: string }) =>
      api.post(`/admin/password-requests/${id}/resolve`, { status, newPassword }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "password-requests"] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
    },
  });
}

// ----------------- Discounts -----------------
export const useAdminDiscounts = (params: { userId?: string; active?: string; page?: number }) =>
  useQuery({
    queryKey: ["admin", "discounts", params],
    queryFn: () =>
      api.get<Page<Discount>>("/admin/discounts", {
        userId: params.userId,
        active: params.active,
        page: params.page ?? 1,
        pageSize: 15,
      }),
    placeholderData: keepPreviousData,
  });

export function useDiscountMutations() {
  const qc = useQueryClient();
  const invalidateDiscounts = () => {
    qc.invalidateQueries({ queryKey: ["admin", "discounts"] });
  };

  const createDiscount = useMutation({
    mutationFn: (b: { userId?: string | null; categoryId?: number | null; productId?: string | null; pct: string; startsAt?: string | null; endsAt?: string | null; isActive?: boolean }) =>
      api.post<Discount>("/admin/discounts", b),
    onSuccess: invalidateDiscounts,
  });

  const updateDiscount = useMutation({
    mutationFn: ({ id, ...b }: { id: string; pct?: string; startsAt?: string | null; endsAt?: string | null; isActive?: boolean }) =>
      api.patch<Discount>(`/admin/discounts/${id}`, b),
    onSuccess: invalidateDiscounts,
  });

  const deleteDiscount = useMutation({
    mutationFn: (id: string) => api.del(`/admin/discounts/${id}`),
    onSuccess: invalidateDiscounts,
  });

  return { createDiscount, updateDiscount, deleteDiscount };
}

// ----------------- Reports -----------------
export const useAdminSalesReport = (params: { from?: string; to?: string }) =>
  useQuery({
    queryKey: ["admin", "reports", "sales", params],
    queryFn: () =>
      api.get<{
        summary: { totalRevenue: string; totalOrders: number; completedOrders: number; averageOrderValue: string };
        statusCounts: Record<string, number>;
        orders: { id: string; orderNo: string; customerName: string; warehouseName: string; status: string; itemsCount: number; total: string; createdAt: string }[];
      }>("/admin/reports/sales", params),
  });
