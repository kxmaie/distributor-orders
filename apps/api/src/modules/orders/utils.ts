import { HttpError } from "../../lib/errors";

export const formatOrderNo = (year: number, n: number) => `ORD-${year}-${String(n).padStart(6, "0")}`;

/** Merge duplicate variants and sort by id (consistent lock order => no deadlocks between orders). */
export function mergeItems(items: { variantId: bigint; qty: number }[]) {
  const m = new Map<string, { variantId: bigint; qty: number }>();
  for (const it of items) {
    const k = it.variantId.toString();
    const cur = m.get(k);
    const qty = (cur?.qty ?? 0) + it.qty;
    if (qty > 100000) throw new HttpError(400, "QTY_TOO_LARGE", `Quantity too large for variant ${k}`);
    m.set(k, { variantId: it.variantId, qty });
  }
  return [...m.values()].sort((a, b) => (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0));
}
