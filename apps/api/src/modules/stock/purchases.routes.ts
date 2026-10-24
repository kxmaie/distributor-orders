import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/db";
import { HttpError } from "../../lib/errors";
import { audit } from "../../lib/audit";
import { postVoucher } from "../accounting/ledger";

const Body = z.object({
  invoiceNo: z.string().trim().min(1).max(60).optional(),
  supplier: z.string().trim().min(1).max(160),
  warehouseId: z.number().int().positive(),
  note: z.string().trim().max(500).nullable().optional(),
  items: z.array(z.object({ variantId: z.string().regex(/^\d+$/).transform((value) => BigInt(value)), qty: z.number().int().min(1).max(100000), unitCost: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/) })).min(1).max(100),
});
const IdParam = z.object({ id: z.string().regex(/^\d+$/).transform((value) => BigInt(value)) });
const includeItems = { items: { include: { variant: { select: { id: true, sku: true, label: true, product: { select: { name: true, unit: true } } } }, warehouse: { select: { id: true, name: true } } } } } satisfies Prisma.PurchaseInclude;
const purchaseRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("super_admin"));
  app.get("/purchases", async () => prisma.purchase.findMany({ where: { voidedAt: null }, include: includeItems, orderBy: { createdAt: "desc" }, take: 500 }));

  app.post("/purchases", async (req, reply) => {
    const input = Body.parse(req.body);
    const invoiceNo = input.invoiceNo || `PUR-${new Date().getFullYear()}-${Date.now()}`;
    const variantIds = [...new Set(input.items.map((item) => item.variantId.toString()))].map(BigInt);
    const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true }, select: { id: true } });
    if (variants.length !== variantIds.length) throw new HttpError(400, "INVALID_PURCHASE_VARIANT");
    const warehouse = await prisma.warehouse.findFirst({ where: { id: input.warehouseId, isActive: true } });
    if (!warehouse) throw new HttpError(404, "WAREHOUSE_NOT_FOUND");
    const total = input.items.reduce((sum, item) => sum.add(new Prisma.Decimal(item.unitCost).mul(item.qty)), new Prisma.Decimal(0)).toFixed(2);
    const row = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({ data: { invoiceNo, supplier: input.supplier, total, note: input.note ?? undefined, createdBy: BigInt(req.user.sub) } });
      for (const item of input.items) {
        const lineTotal = new Prisma.Decimal(item.unitCost).mul(item.qty).toFixed(2);
        await tx.purchaseItem.create({ data: { purchaseId: purchase.id, variantId: item.variantId, warehouseId: input.warehouseId, qty: item.qty, unitCost: item.unitCost, lineTotal } });
        await tx.stockLevel.upsert({ where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: input.warehouseId } }, create: { variantId: item.variantId, warehouseId: input.warehouseId, onHand: item.qty, reserved: 0 }, update: { onHand: { increment: item.qty } } });
        await tx.stockMovement.create({ data: { variantId: item.variantId, warehouseId: input.warehouseId, type: "receipt", qty: item.qty, refType: "purchase", refId: purchase.id, note: `فاتورة مشتريات ${invoiceNo}`, createdBy: BigInt(req.user.sub) } });
      }
      await postVoucher(tx, { type: "journal", description: `فاتورة مشتريات ${invoiceNo}`, actorId: BigInt(req.user.sub), entries: [{ cod