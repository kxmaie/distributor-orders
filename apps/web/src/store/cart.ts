import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  variantId: string; productId: string; productName: string; variantLabel: string;
  sku: string; unit: string; qty: number;
};
type S = {
  items: CartItem[];
  open: boolean;
  setOpen: (b: boolean) => void;
  add: (i: Omit<CartItem, "qty">, qty: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};
const clamp = (n: number) => Math.max(1, Math.min(9999, Math.floor(n) || 1));

export const useCart = create<S>()(
  persist(
    (set) => ({
      items: [],
      open: false,
      setOpen: (open) => set({ open }),
      add: (i, qty) =>
        set((s) => {
          const ex = s.items.find((x) => x.variantId === i.variantId);
          return {
            items: ex
              ? s.items.map((x) => (x.variantId === i.variantId ? { ...x, qty: clamp(x.qty + qty) } : x))
              : [...s.items, { ...i, qty: clamp(qty) }],
          };
        }),
      setQty: (id, qty) => set((s) => ({ items: s.items.map((x) => (x.variantId === id ? { ...x, qty: clamp(qty) } : x)) })),
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.variantId !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "cart-v1", partialize: (s) => ({ items: s.items }) },
  ),
);
export const cartCount = (items: CartItem[]) => items.reduce((a, i) => a + i.qty, 0);
