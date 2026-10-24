import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db";
import { HttpError } from "../../lib/errors";

type ProductRow = Prisma.ProductGetPayload<{
  include: { category: { select: { id: true; name: true; slug: true } }; variants: true; unitInfo: { select: { label: true } } };
}>;

const productInclude = {
  category: { select: { id: true, name: true, slug: true } },
  unitInfo: { select: { label: true } },
  variants: { where: { isActive: true }, orderBy: { id: "asc" as const } },
};

export async function getUserDiscount(userId: bigint): Promise<Prisma.Decimal> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultDiscountPct: true, isActive: true },
  });
  if (!me || !me.isActive) throw new HttpError(401, "UNAUTHORIZED");
  return me.defaultDiscountPct;
}

export const listCategories = () =>
  prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, sortOrder: true },
  });

async function availability(variantIds: bigint[]) {
  const map = new Map<bigint, number>();
  if (!variantIds.length) return map;
  const rows = await prisma.stockLevel.groupBy({
    by: ["variantId"],
    where: { variantId: { in: variantIds }, warehouse: { isActive: true } },
    _sum: { onHand: true, reserved: true },
  });
  for (const r of rows) map.set(r.variantId, Math.max(0, (r._sum.onHand ?? 0) - (r._sum.reserved ?? 0)));
  return map;
}

// NOTE: prices here only apply the user's default discount. Full pricing
// (per-product/category discounts) is computed server-side in Phase 3 (/cart/price).
function shape(p: ProductRow, discountPct: Prisma.Decimal, avail: Map<bigint, number>) {
  const factor = new Prisma.Decimal(100).minus(discountPct).div(100);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    unit: p.unit,
    unitLabel: p.unitInfo.label,
    piecesPerUnit: p.piecesPerUnit,
    category: p.category,
    basePrice: p.basePrice.mul(p.piecesPerUnit).toFixed(2),
    variants: p.variants.map((v) => {
      const price = p.basePrice.plus(v.priceDelta).mul(p.piecesPerUnit);
      const available = avail.get(v.id) ?? 0;
      return {
        id: v.id,
        sku: v.sku,
        label: v.label,
        price: price.toFixed(2),
        yourPrice: price.mul(factor).toFixed(2),
        available,
        inStock: available > 0,
      };
    }),
  };
}

export async function listProducts(
  q: { category?: string; q?: string; page: number; pageSize: number },
  discountPct: Prisma.Decimal,
) {
  const catFilter: Prisma.CategoryWhereInput = { isActive: true };
  if (q.category) {
    if (/^\d+$/.test(q.category)) catFilter.id = Number(q.category);
    else catFilter.slug = q.category;
  }
  const where: Prisma.ProductWhereInput = { isActive: true, category: catFilter };
  // Keep catalog search case-insensitive across PostgreSQL installations.
  if (q.q) where.OR = [{ name: { contains: q.q, mode: "insensitive" } }, { description: { contains: q.q, mode: "insensitive" } }];

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ name: "asc" }, { id: "asc" }], // Pagination uses a deterministic order.
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  const avail = await availability(rows.flatMap((p) => p.variants.map((v) => v.id)));
  return { items: rows.map((p) => shape(p, discountPct, avail)), total, page: q.page, pageSize: q.pageSize };
}

export async function getProduct(id: bigint, discountPct: Prisma.Decimal) {
  const p = await prisma.product.findFirst({
    where: { id, isActive: true, category: { isActive: true } },
    include: productInclude,
  });
  if (!p) throw new HttpError(404, "PRODUCT_NOT_FOUND");
  const avail = await availability(p.variants.map((v) => v.id));
  return shape(p, discountPct, avail);
}
