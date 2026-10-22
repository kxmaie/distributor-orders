import { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { StockAdjustBody, StockListQuery, MovementQuery } from "@do/shared";
import { prisma } from "../../lib/db";
import { HttpError } from "../../lib/errors";
import { toJson } from "../../lib/json";

type AdjustInput = z.output<typeof StockAdjustBody>;
type ListQuery = z.output<typeof StockListQuery>;
type MoveQuery = z.output<typeof MovementQuery>;

const key = (variantId: bigint, warehouseId: number) => ({ variantId_warehouseId: { variantId, warehouseId } });

// Done outside the transaction: a duplicate-key error inside an interactive transaction can poison it.
async function ensureRow(variantId: bigint, warehouseId: number) {
  const ex = await prisma.stockLevel.findUnique({ where: key(variantId, warehouseId), select: { variantId: true } });
  if (ex) return;
  try {
    await prisma.stockLevel.create({ data: { variantId, warehouseId } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; // raced: fine
  }
}

export async function adjustStock(input: AdjustInput, actorId: bigint, ip?: string) {
  const { variantId, warehouseId, delta, type, note } = input;
  if (type === "receipt" && delta <= 0) throw new HttpError(400, "INVALID_DELTA", "receipt requires a positive delta");

  const [variant, wh] = await Promise.all([
    prisma.productVariant.findUnique({ where: { id: variantId }, select: { id: true } }),
    prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { isActive: true } }),
  ]);
  if (!variant) throw new HttpError(404, "VARIANT_NOT_FOUND");
  if (!wh || !wh.isActive) throw new HttpError(404, "WAREHOUSE_NOT_FOUND");

  await ensureRow(variantId, warehouseId);

  return prisma.$transaction(async (tx) => {
    // Atomic single-statement update (SQL Server has no SELECT ... FOR UPDATE).
    // Never lets on_hand drop below what is already reserved (which also implies >= 0).
    const n = await tx.$executeRaw`
      UPDATE stock_levels SET on_hand = on_hand + ${delta}
      WHERE variant_id = ${variantId} AND warehouse_id = ${warehouseId}
        AND on_hand + ${delta} >= reserved`;
    if (n !== 1) throw new HttpError(409, "INSUFFICIENT_STOCK", "Stock cannot go below the reserved quantity");

    await tx.stockMovement.create({
      data: { variantId, warehouseId, type, qty: delta, note, createdBy: actorId, refType: "manual" },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "stock.adjust",
        entity: "stock_level",
        entityId: `${variantId}:${warehouseId}`,
        meta: toJson({ delta, type, note }),
        ip,
      },
    });
    return tx.stockLevel.findUniqueOrThrow({ where: key(variantId, warehouseId) });
  });
}

export async function listStock(q: ListQuery) {
  const where: Prisma.StockLevelWhereInput = {};
  if (q.warehouseId) where.warehouseId = q.warehouseId;
  if (q.variantId) where.variantId = q.variantId;
  if (q.q) where.variant = { OR: [{ sku: { contains: q.q } }, { label: { contains: q.q } }, { product: { name: { contains: q.q } } }] };

  const [total, rows] = await Promise.all([
    prisma.stockLevel.count({ where }),
    prisma.stockLevel.findMany({
      where,
      include: {
        variant: { select: { sku: true, label: true, product: { select: { id: true, name: true } } } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: [{ variantId: "asc" }, { warehouseId: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    items: rows.map((r) => ({ ...r, available: r.onHand - r.reserved })),
    total, page: q.page, pageSize: q.pageSize,
  };
}

export async function listMovements(q: MoveQuery) {
  const where: Prisma.StockMovementWhereInput = {};
  if (q.warehouseId) where.warehouseId = q.warehouseId;
  if (q.variantId) where.variantId = q.variantId;
  if (q.type) where.type = q.type;
  const [total, items] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}
