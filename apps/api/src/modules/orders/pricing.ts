import { Prisma } from "@prisma/client";
import { HttpError } from "../../lib/errors";
import { mergeItems } from "./utils";

type Db = Prisma.TransactionClient;
type Dec = Prisma.Decimal;

/** Discount per line is rounded to 2 decimals (half up); line_total = gross - discount. */
export function calcLine(unitPrice: Dec, pct: Dec, qty: number) {
  const gross = unitPrice.mul(qty);
  const discount = gross.mul(pct).div(100).toDecimalPlaces(2, 4);
  return { gross, discount, lineTotal: gross.minus(discount) };
}

export type PricedLine = {
  variantId: bigint;
  productId: bigint;
  sku: string;
  productName: string;
  variantLabel: string;
  unitPrice: Dec;
  discountPct: Dec;
  qty: number;
  gross: Dec;
  discount: Dec;
  lineTotal: Dec;
};
export type Pricing = { lines: PricedLine[]; subtotal: Dec; discountTotal: Dec; total: Dec };

/**
 * Server-side pricing. Discount rule (no stacking): the BEST (highest) of
 *  - the user's default_discount_pct
 *  - any active, in-date `discounts` row that applies to this user (or all users),
 *    this product (or any) and this category (or any).
 */
export async function priceItems(db: Db, userId: bigint, items: { variantId: bigint; qty: number }[]): Promise<Pricing> {
  const merged = mergeItems(items);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { defaultDiscountPct: true, isActive: true },
  });
  if (!user || !user.isActive) throw new HttpError(401, "UNAUTHORIZED");

  const variants = await db.productVariant.findMany({
    where: { id: { in: merged.map((m) => m.variantId) } },
    include: {
      product: {
        select: {
          id: true, name: true, basePrice: true, isActive: true, categoryId: true,
          category: { select: { isActive: true } },
        },
      },
    },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const now = new Date();
  const discounts = await db.discount.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ userId: null }, { userId }] },
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
  });

  const lines: PricedLine[] = merged.map((m) => {
    const v = byId.get(m.variantId);
    if (!v || !v.isActive || !v.product.isActive || !v.product.category.isActive) {
      throw new HttpError(409, "ITEM_UNAVAILABLE", `Variant ${m.variantId} is not available`);
    }
    const unitPrice = v.product.basePrice.plus(v.priceDelta);
    if (unitPrice.lt(0)) throw new HttpError(409, "INVALID_PRICE", `Variant ${v.sku} has an invalid price`);

    let pct: Dec = user.defaultDiscountPct;
    for (const d of discounts) {
      const okProduct = d.productId === null || d.productId === v.product.id;
      const okCategory = d.categoryId === null || d.categoryId === v.product.categoryId;
      if (okProduct && okCategory && d.pct.gt(pct)) pct = d.pct;
    }
    const { gross, discount, lineTotal } = calcLine(unitPrice, pct, m.qty);
    return {
      variantId: v.id, productId: v.product.id, sku: v.sku,
      productName: v.product.name, variantLabel: v.label,
      unitPrice, discountPct: pct, qty: m.qty, gross, discount, lineTotal,
    };
  });

  const zero = new Prisma.Decimal(0);
  return {
    lines,
    subtotal: lines.reduce((a, l) => a.plus(l.gross), zero),
    discountTotal: lines.reduce((a, l) => a.plus(l.discount), zero),
    total: lines.reduce((a, l) => a.plus(l.lineTotal), zero),
  };
}

export type Shortage = { variantId: bigint; sku: string; requested: number; available: number };

/** Which active warehouses can fulfil the WHOLE cart (an order ships from a single warehouse). */
export async function findWarehouses(db: Db, lines: PricedLine[], requestedId?: number) {
  const whs = await db.warehouse.findMany({
    where: { isActive: true, ...(requestedId ? { id: requestedId } : {}) },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  if (requestedId && whs.length === 0) throw new HttpError(404, "WAREHOUSE_NOT_FOUND");

  const levels = await db.stockLevel.findMany({
    where: { variantId: { in: lines.map((l) => l.variantId) }, warehouseId: { in: whs.map((w) => w.id) } },
  });
  const avail = new Map<string, number>();
  for (const s of levels) avail.set(`${s.variantId}:${s.warehouseId}`, s.onHand - s.reserved);
  const get = (v: bigint, w: number) => Math.max(0, avail.get(`${v}:${w}`) ?? 0);

  const fulfillable = whs.filter((w) => lines.every((l) => get(l.variantId, w.id) >= l.qty));
  const shortages: Shortage[] = [];
  for (const l of lines) {
    const best = whs.reduce((mx, w) => Math.max(mx, get(l.variantId, w.id)), 0);
    if (l.qty > best) shortages.push({ variantId: l.variantId, sku: l.sku, requested: l.qty, available: best });
  }
  return { fulfillable, shortages };
}
