import type { Prisma } from "@prisma/client";
import type { DiscountCreate, DiscountListQuery, DiscountUpdate } from "@do/shared";
import type { z } from "zod";
import { prisma } from "../../lib/db";
import { audit } from "../../lib/audit";
import { HttpError } from "../../lib/errors";

type DiscountCreateInput = z.output<typeof DiscountCreate>;
type DiscountUpdateInput = z.output<typeof DiscountUpdate>;
type DiscountListQueryInput = z.output<typeof DiscountListQuery>;

const discountInclude = {
  user: { select: { id: true, username: true, fullName: true } },
  category: { select: { id: true, name: true, slug: true } },
  product: { select: { id: true, name: true } },
} satisfies Prisma.DiscountInclude;

export async function listDiscounts(q: DiscountListQueryInput) {
  const where: Prisma.DiscountWhereInput = {};
  if (q.userId) where.userId = q.userId;
  if (q.active) where.isActive = q.active === "true";

  const [total, items] = await Promise.all([
    prisma.discount.count({ where }),
    prisma.discount.findMany({
      where,
      include: discountInclude,
      orderBy: [{ id: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function createDiscount(input: DiscountCreateInput, actorId: bigint, ip?: string) {
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;

  const discount = await prisma.discount.create({
    data: {
      userId: input.userId,
      categoryId: input.categoryId,
      productId: input.productId,
      pct: input.pct,
      startsAt,
      endsAt,
      isActive: input.isActive ?? true,
    },
    include: discountInclude,
  });

  await audit(actorId, "discount.create", "discount", discount.id, { pct: input.pct }, ip);
  return discount;
}

export async function updateDiscount(id: bigint, input: DiscountUpdateInput, actorId: bigint, ip?: string) {
  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "DISCOUNT_NOT_FOUND", "الخصم غير موجود");

  const data: Prisma.DiscountUpdateInput = {};
  if (input.pct !== undefined) data.pct = input.pct;
  if (input.startsAt !== undefined) data.startsAt = input.startsAt ? new Date(input.startsAt) : null;
  if (input.endsAt !== undefined) data.endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.userId !== undefined) data.user = input.userId ? { connect: { id: input.userId } } : { disconnect: true };
  if (input.categoryId !== undefined) data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
  if (input.productId !== undefined) data.product = input.productId ? { connect: { id: input.productId } } : { disconnect: true };

  const updated = await prisma.discount.update({
    where: { id },
    data,
    include: discountInclude,
  });

  await audit(actorId, "discount.update", "discount", id, input, ip);
  return updated;
}

export async function deleteDiscount(id: bigint, actorId: bigint, ip?: string) {
  const existing = await prisma.discount.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "DISCOUNT_NOT_FOUND", "الخصم غير موجود");

  await prisma.discount.update({
    where: { id },
    data: { isActive: false },
  });

  await audit(actorId, "discount.deactivate", "discount", id, undefined, ip);
}
