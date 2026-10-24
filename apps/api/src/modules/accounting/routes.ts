import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/db";
import { HttpError } from "../../lib/errors";
import { averageUnitCost, postVoucher } from "./ledger";

const plugin: FastifyPluginAsync = async (app) => {
 app.addHook("preHandler", app.requireRole("super_admin"));
 app.get("/returns/purchases", async () => prisma.purchaseReturn.findMany({include:{purchase:{select:{invoiceNo:true}},items:{include:{variant:{include:{product:true}},warehouse:true}}},orderBy:{createdAt:"desc"},take:500}));
 app.post("/returns/purchases", async (req,reply) => {
  const input=z.object({purchaseId:z.string().regex(/^\d+$/).transform(BigInt),note:z.string().max(500).optional(),items:z.array(z.object({purchaseItemId:z.string().regex(/^\d+$/).transform(BigInt),qty:z.number().int().min(1)})).min(1).max(100)}).parse(req.body);
  if(new Set(input.items.map(x=>x.purchaseItemId.toString())).size!==input.items.length)throw new HttpError(400,"DUPLICATE_RETURN_ITEM");
  const actor=BigInt(req.user.sub);
  const row=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM purchases WHERE id=${input.purchaseId} FOR UPDATE`;
   const purchase=await tx.purchase.findFirst({where:{id:input.purchaseId,voidedAt:null},include:{items:true}});if(!purchase)throw new HttpError(404,"PURCHASE_NOT_FOUND");
   const lines=[] as {source:typeof purchase.items[number];qty:number;cost:Prisma.Decimal;amount:Prisma.Decimal}[];
   let total=new Prisma.Decimal(0);
   for(const x of input.items){const source=purchase.items.find(i=>i.id===x.purchaseItemId);if(!source)throw new HttpError(400,"RETURN_ITEM_NOT_IN_PURCHASE");const previous=await tx.purchaseReturnItem.aggregate({where:{purchaseItemId:source.id},_sum:{qty:true}});if(x.qty>source.qty-(previous._sum.qty??0))throw new HttpError(409,"RETURN_QTY_EXCEEDED","الكمية أكبر من المتبقي من الفاتورة الأصلية");const amount=source.unitCost.mul(x.qty);lines.push({source,qty:x.qty,cost:source.unitCost,amount});total=total.add(amount);}
   for(const l of lines){const changed=await tx.$executeRaw`UPDATE stock_levels SET on_hand=on_hand-${l.qty} WHERE variant_id=${l.source.variantId} AND warehouse_id=${l.source.warehouseId} AND on_hand-${l.qty}>=reserved`;if(changed!==1)throw new HttpError(409,"RETURN_STOCK_UNAVAILABLE","الكمية المرتجعة تتجاوز المخزون المتاح");}
   const r=await tx.purchaseReturn.create({data:{purchaseId:purchase.id,returnNo:`PR-${Date.now()}`,supplier:purchase.supplier,total,note:input.note,createdBy:actor}});
   for(const l of lines){await tx.purchaseReturnItem.create({data:{returnId:r.id,purchaseItemId:l.source.id,variantId:l.source.variantId,warehouseId:l.source.warehouseId,qty:l.qty,unitCost:l.cost,lineTotal:l.amount}});await tx.stockMovement.create({data:{variantId:l.source.variantId,warehouseId:l.source.warehouseId,type:"adjustment",qty:-l.qty,refType:"purchase_return",refId:r.id,note:`مرتجع مشتريات ${r.returnNo}`,createdBy:actor}});}
   await postVoucher(tx,{type:"journal",description:`مرتجع مشتريات ${r.returnNo}`,actorId:actor,entries:[{code:"2000",debit:total,credit:"0"},{code:"1200",debit:"0",credit:total}]});
   return tx.purchaseReturn.findUniqueOrThrow({where:{id:r.id},include:{items:{include:{variant:{include:{product:true}},warehouse:true}}}});
  });return reply.code(201).send(row);
 }); app.get("/returns/sales