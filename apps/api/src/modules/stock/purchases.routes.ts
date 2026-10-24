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
      await postVoucher(tx, { type: "journal", description: `فاتورة مشتريات ${invoiceNo}`, actorId: BigInt(req.user.sub), entries: [{ code: "1200", debit: total, credit: "0" }, { code: "2000", debit: "0", credit: total }] });
      return tx.purchase.findUniqueOrThrow({ where: { id: purchase.id }, include: includeItems });
    });
    await audit(BigInt(req.user.sub), "purchase.create", "purchase", row.id, { invoiceNo, supplier: input.supplier, total }, req.ip);
    return reply.code(201).send(row);
  });

  app.patch("/purchases/:id", async (req) => {
    const { id } = IdParam.parse(req.params); const input = Body.parse(req.body);
    const variantIds = [...new Set(input.items.map((item) => item.variantId.toString()))].map(BigInt);
    const [variants, warehouse] = await Promise.all([
      prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true }, select: { id: true } }),
      prisma.warehouse.findFirst({ where: { id: input.warehouseId, isActive: true } }),
    ]);
    if (variants.length !== variantIds.length) throw new HttpError(400, "INVALID_PURCHASE_VARIANT");
    if (!warehouse) throw new HttpError(404, "WAREHOUSE_NOT_FOUND");
    const total = input.items.reduce((sum, item) => sum.add(new Prisma.Decimal(item.unitCost).mul(item.qty)), new Prisma.Decimal(0));
    const row = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchases WHERE id=${id} FOR UPDATE`;
      const purchase = await tx.purchase.findFirst({ where: { id, voidedAt: null }, include: { items: true } });
      if (!purchase) throw new HttpError(404, "PURCHASE_NOT_FOUND");
      if (await tx.purchaseReturn.count({ where: { purchaseId: id } })) throw new HttpError(409, "PURCHASE_HAS_RETURNS", "لا يمكن تعديل فاتورة لها مرتجعات مسجلة");
      await postVoucher(tx, { type: "journal", description: `عكس تعديل فاتورة ${purchase.invoiceNo}`, actorId: BigInt(req.user.sub), entries: [{ code: "2000", debit: purchase.total, credit: "0" }, { code: "1200", debit: "0", credit: purchase.total }] });
      const balances = new Map<string, number>();
      for (const item of purchase.items) { const key = `${item.variantId}:${item.warehouseId}`; balances.set(key, (balances.get(key) ?? 0) - item.qty); }
      for (const item of input.items) { const key = `${item.variantId}:${input.warehouseId}`; balances.set(key, (balances.get(key) ?? 0) + item.qty); }
      for (const [key, delta] of balances) {
        if (!delta) continue; const [variantIdRaw, warehouseIdRaw] = key.split(":"); const variantId = BigInt(variantIdRaw); const warehouseId = Number(warehouseIdRaw);
        if (delta > 0) await tx.stockLevel.upsert({ where: { variantId_warehouseId: { variantId, warehouseId } }, create: { variantId, warehouseId, onHand: delta, reserved: 0 }, update: { onHand: { increment: delta } } });
        else { const changed = await tx.$executeRawUnsafe("UPDATE stock_levels SET on_hand = on_hand + $1 WHERE variant_id = $2 AND warehouse_id = $3 AND on_hand + $1 >= reserved", delta, variantId, warehouseId); if (changed !== 1) throw new HttpError(409, "PURCHASE_STOCK_ALREADY_USED", "لا يمكن خفض كمية الفاتورة لأن جزءًا من مخزونها محجوز أو تم صرفه"); }
        await tx.stockMovement.create({ data: { variantId, warehouseId, type: "adjustment", qty: delta, refType: "purchase_edit", refId: id, note: `تعديل فاتورة مشتريات ${input.invoiceNo ?? purchase.invoiceNo}`, createdBy: BigInt(req.user.sub) } });
      }
      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
      await tx.purchaseItem.createMany({ data: input.items.map((item) => ({ purchaseId: id, variantId: item.variantId, warehouseId: input.warehouseId, qty: item.qty, unitCost: item.unitCost, lineTotal: new Prisma.Decimal(item.unitCost).mul(item.qty) })) });
      await tx.purchase.update({ where: { id }, data: { invoiceNo: input.invoiceNo ?? purchase.invoiceNo, supplier: input.supplier, total: total.toFixed(2), note: input.note ?? null } });
      await postVoucher(tx, { type: "journal", description: `تعديل فاتورة مشتريات ${input.invoiceNo ?? purchase.invoiceNo}`, actorId: BigInt(req.user.sub), entries: [{ code: "1200", debit: total, credit: "0" }, { code: "2000", debit: "0", credit: total }] });
      await tx.auditLog.create({ data: { actorId: BigInt(req.user.sub), action: "purchase.update", entity: "purchase", entityId: id.toString(), meta: JSON.stringify({ invoiceNo: input.invoiceNo ?? purchase.invoiceNo, total: total.toFixed(2), itemCount: input.items.length }), ip: req.ip } });
      return tx.purchase.findUniqueOrThrow({ where: { id }, include: includeItems });
    });
    return row;
  });

  app.delete("/purchases/:id", async (req, reply) => {
    const { id } = IdParam.parse(req.params); const actorId = BigInt(req.user.sub);
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM purchases WHERE id=${id} FOR UPDATE`;
      const purchase = await tx.purchase.findFirst({ where: { id, voidedAt: null }, include: { items: true } });
      if (!purchase) throw new HttpError(404, "PURCHASE_NOT_FOUND");
      const quantities = new Map<string, number>();
      for (const item of purchase.items) { const returned = await tx.purchaseReturnItem.aggregate({ where: { purchaseItemId: item.id }, _sum: { qty: true } }); const remaining = item.qty - (returned._sum.qty ?? 0); if (remaining > 0) { const key = `${item.variantId}:${item.warehouseId}`; quantities.set(key, (quantities.get(key) ?? 0) + remaining); } }
      for (const [key, qty] of quantities) {
        const [variantIdRaw, warehouseIdRaw] = key.split(":"); const variantId = BigInt(variantIdRaw); const warehouseId = Number(warehouseIdRaw);
        const changed = await tx.$executeRawUnsafe("UPDATE stock_levels SET on_hand = on_hand - $1 WHERE variant_id = $2 AND warehouse_id = $3 AND on_hand - $1 >= reserved", qty, variantId, warehouseId);
        if (changed !== 1) throw new HttpError(409, "PURCHASE_STOCK_ALREADY_USED", "لا يمكن حذف الفاتورة لأن جزءًا من مخزونها محجوز أو تم صرفه");
        await tx.stockMovement.create({ data: { variantId, warehouseId, type: "adjustment", qty: -qty, refType: "purchase_void", refId: id, note: `إلغاء فاتورة مشتريات ${purchase.invoiceNo}`, createdBy: actorId } });
      }
      const returnedValue = await tx.purchaseReturn.aggregate({ where: { purchaseId: id }, _sum: { total: true } }); const remainingValue = new Prisma.Decimal(purchase.total).sub(returnedValue._sum.total ?? 0).toFixed(2); if (Number(remainingValue) > 0) await postVoucher(tx, { type: "journal", description: `إلغاء فاتورة مشتريات ${purchase.invoiceNo}`, actorId, entries: [{ code: "2000", debit: remainingValue, credit: "0" }, { code: "1200", debit: "0", credit: remainingValue }] });
      await tx.purchase.update({ where: { id }, data: { voidedAt: new Date(), voidedBy: actorId } });
      await tx.auditLog.create({ data: { actorId, action: "purchase.void", entity: "purchase", entityId: id.toString(), meta: JSON.stringify({ invoiceNo: purchase.invoiceNo, total: purchase.total.toString(), itemCount: purchase.items.length }), ip: req.ip } });
      return { invoiceNo: purchase.invoiceNo };
    });
    return reply.code(200).send({ deleted: true, ...result });
  });
};
export default purchaseRoutes;
