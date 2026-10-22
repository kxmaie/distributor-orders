import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { api, ApiError } from "../lib/api";
import type { Category, OrderDetail, OrderSummary, Page, Priced, Product } from "../lib/types";
import { useCart } from "../store/cart";
import { useUI } from "../store/ui";

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories"), staleTime: 5 * 60_000 });

export const useProducts = (p: { category?: string; q?: string; page: number; pageSize?: number }) =>
  useQuery({
    queryKey: ["products", p],
    queryFn: () => api.get<Page<Product>>("/products", { category: p.category, q: p.q, page: p.page, pageSize: p.pageSize ?? 12 }),
    placeholderData: keepPreviousData,
  });

export const useProduct = (id: string) =>
  useQuery({ queryKey: ["product", id], queryFn: () => api.get<Product>(`/products/${id}`) });

/** Server-priced cart. Prices/discounts are never computed in the browser. */
export function useCartQuote(enabled = true) {
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);
  const push = useUI((s) => s.push);
  const lines = useMemo(() => items.map((i) => ({ variantId: i.variantId, qty: i.qty })), [items]);

  const q = useQuery({
    queryKey: ["cart-price", lines],
    queryFn: () => api.post<Priced>("/cart/price", { items: lines }),
    enabled: enabled && lines.length > 0,
    retry: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const e = q.error;
    if (e instanceof ApiError && e.code === "ITEM_UNAVAILABLE") {
      const m = /Variant (\d+)/.exec(e.message);
      if (m) {
        remove(m[1]);
        push("تم حذف منتج لم يعد متاحًا من السلة", "info");
      }
    }
  }, [q.error, remove, push]);

  return q;
}

export const useOrders = (status?: string) =>
  useInfiniteQuery({
    queryKey: ["orders", status ?? "all"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.get<Page<OrderSummary>>("/orders", { status, page: pageParam, pageSize: 10 }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });

export const useOrder = (id: string) =>
  useQuery({ queryKey: ["order", id], queryFn: () => api.get<OrderDetail>(`/orders/${id}`) });
