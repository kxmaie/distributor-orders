import type { FastifyPluginAsync } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/db";
import { HttpError } from "../../lib/errors";
import { averageUnitCost, postVoucher } from "./ledger";

const plugin: FastifyPluginAsync = async (app) => {
 app.addHook("preHandler", app.requireRole("super_admin"));
 app.get("/returns/purchases", async () => prisma.purchaseReturn.findMany({include:{purchase:{select:{invoiceNo:true}},items:{include:{variant:{include:{product:true}},warehouse:true}}},orderBy:{createdAt:"desc"},take:500}));
 app.get("/returns/purchases/source/:id",async(req)=>{const {id}=z.object({id:z.string().regex(/^\d+$/).transform(BigInt)}).parse(req.params);const purchase=await prisma.purchase.findFirst({where:{id,voidedAt:null},include:{items:{include:{variant:{include:{product:true}},warehouse:true},orderBy:{id:"asc"}}}});if(!purchase)throw new HttpError(404,"PURCHASE_NOT_FOUND");const items=await Promise.all(purchase.items.map(async item=>{const previous=await prisma.purchaseReturnItem.aggregate({where:{purchaseItemId:item.id},_sum:{qty:true}});const returnedQty=previous._sum.qty??0;return {...item,returnedQty,returnableQty:Math.max(0,item.qty-returnedQty)}}));return {...purchase,items}});
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
 }); app.get("/returns/sales",async()=>prisma.salesReturn.findMany({include:{order:{include:{user:true}},items:{include:{variant:{include:{product:true}},warehouse:true}}},orderBy:{createdAt:"desc"},take:500}));
 app.get("/returns/sales/source/:id",async(req)=>{
  const {id}=z.object({id:z.string().regex(/^\d+$/).transform(BigInt)}).parse(req.params);
  const order=await prisma.order.findFirst({where:{id,status:"delivered"},include:{items:{include:{variant:{include:{product:true}},deliveries:true},orderBy:{id:"asc"}},warehouse:true,user:{select:{fullName:true,phone:true}}}});
  if(!order)throw new HttpError(404,"ORDER_NOT_RETURNABLE");
  const items=await Promise.all(order.items.map(async item=>{
   const deliveredQty=item.deliveries.reduce((sum,d)=>sum+d.qty,0);
   const deliveredTotal=item.deliveries.reduce((sum,d)=>sum.add(d.amount),new Prisma.Decimal(0));
   const previous=await prisma.salesReturnItem.aggregate({where:{orderItemId:item.id},_sum:{qty:true,lineTotal:true}});
   const returnedQty=previous._sum.qty??0;
   const returnedAmount=new Prisma.Decimal(previous._sum.lineTotal??0);
   const returnableQty=Math.max(0,deliveredQty-returnedQty);
   const returnableAmount=deliveredTotal.sub(returnedAmount);
   return {...item,deliveredQty,returnedQty,returnableQty,returnableAmount:returnableAmount.toFixed(2),returnUnitPrice:deliveredQty?deliveredTotal.div(deliveredQty).toFixed(2):"0.00"};
  }));
  return {...order,items};
 });
 app.post("/returns/sales",async(req,reply)=>{
  const input=z.object({orderId:z.string().regex(/^\d+$/).transform(BigInt),note:z.string().max(500).optional(),items:z.array(z.object({orderItemId:z.string().regex(/^\d+$/).transform(BigInt),qty:z.number().int().min(1)})).min(1).max(100)}).parse(req.body);if(new Set(input.items.map(x=>x.orderItemId.toString())).size!==input.items.length)throw new HttpError(400,"DUPLICATE_RETURN_ITEM");const actor=BigInt(req.user.sub);
  const row=await prisma.$transaction(async tx=>{
   for(const id of input.items.map(x=>x.orderItemId).sort((a,b)=>a<b?-1:a>b?1:0))await tx.$queryRaw`SELECT id FROM order_items WHERE id=${id} FOR UPDATE`;
   const order=await tx.order.findUnique({where:{id:input.orderId},include:{items:{include:{deliveries:{include:{delivery:true}}}}}});if(!order||order.status!=="delivered")throw new HttpError(409,"ORDER_NOT_RETURNABLE","المرتجع متاح للطلبات المسلّمة فقط");
   const lines=[] as {source:typeof order.items[number];qty:number;price:Prisma.Decimal;amount:Prisma.Decimal}[];let total=new Prisma.Decimal(0);
   for(const x of input.items){
    const source=order.items.find(i=>i.id===x.orderItemId);
    if(!source)throw new HttpError(400,"RETURN_ITEM_NOT_IN_ORDER");
    const deliveredQty=source.deliveries.reduce((sum,d)=>sum+d.qty,0);
    const deliveredTotal=source.deliveries.reduce((sum,d)=>sum.add(d.amount),new Prisma.Decimal(0));
    const previous=await tx.salesReturnItem.aggregate({where:{orderItemId:source.id},_sum:{qty:true,lineTotal:true}});
    const returnedQty=previous._sum.qty??0;
    if(x.qty>deliveredQty-returnedQty)throw new HttpError(409,"RETURN_QTY_EXCEEDED","الكمية تتجاوز الكمية المسلّمة المتبقية");
    const remainingQty=deliveredQty-returnedQty;
    const remainingAmount=deliveredTotal.sub(previous._sum.lineTotal??0);
    const amount=x.qty===remainingQty?remainingAmount:deliveredTotal.mul(x.qty).div(deliveredQty).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
    const unitPrice=amount.div(x.qty).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
    lines.push({source,qty:x.qty,price:unitPrice,amount});
    total=total.add(amount);
   }
   const r=await tx.salesReturn.create({data:{returnNo:`SR-${Date.now()}`,orderId:order.id,total,note:input.note,createdBy:actor}});
   for(const l of lines){await tx.salesReturnItem.create({data:{returnId:r.id,orderItemId:l.source.id,variantId:l.source.variantId,warehouseId:order.warehouseId,qty:l.qty,unitPrice:l.price,lineTotal:l.amount}});await tx.stockLevel.upsert({where:{variantId_warehouseId:{variantId:l.source.variantId,warehouseId:order.warehouseId}},create:{variantId:l.source.variantId,warehouseId:order.warehouseId,onHand:l.qty},update:{onHand:{increment:l.qty}}});await tx.stockMovement.create({data:{variantId:l.source.variantId,warehouseId:order.warehouseId,type:"receipt",qty:l.qty,refType:"sales_return",refId:r.id,note:`مرتجع مبيعات ${r.returnNo}`,createdBy:actor}});}
   let returnedCost=new Prisma.Decimal(0);for(const l of lines)returnedCost=returnedCost.add((await averageUnitCost(tx,l.source.variantId)).mul(l.qty));const entries: {code:string;debit:string|Prisma.Decimal;credit:string|Prisma.Decimal}[]=[{code:"4100",debit:total,credit:"0"},{code:"1100",debit:"0",credit:total}];if(returnedCost.gt(0))entries.push({code:"1200",debit:returnedCost,credit:"0"},{code:"5000",debit:"0",credit:returnedCost});await postVoucher(tx,{type:"journal",description:`مرتجع مبيعات ${r.returnNo}`,actorId:actor,entries});
   return tx.salesReturn.findUniqueOrThrow({where:{id:r.id},include:{order:{include:{user:true}},items:true}});
  });return reply.code(201).send(row);
 }); app.get("/accounting/accounts",async()=>prisma.ledgerAccount.findMany({where:{isActive:true},include:{children:true},orderBy:{code:"asc"}}));
 app.post("/accounting/accounts",async(req,reply)=>{const b=z.object({code:z.string().min(1).max(30),name:z.string().min(1).max(120),type:z.enum(["asset","liability","equity","revenue","expense"]),parentId:z.string().regex(/^\d+$/).optional()}).parse(req.body);return reply.code(201).send(await prisma.ledgerAccount.create({data:{...b,parentId:b.parentId?BigInt(b.parentId):undefined}}));});
 app.get("/accounting/vouchers",async()=>prisma.journalVoucher.findMany({include:{entries:{include:{account:true}}},orderBy:{date:"desc"},take:500}));
 app.post("/accounting/vouchers",async(req,reply)=>{const b=z.object({type:z.enum(["receipt","payment","journal"]),description:z.string().min(1).max(500),entries:z.array(z.object({accountId:z.string().regex(/^\d+$/).transform(BigInt),debit:z.string().regex(/^\d+(\.\d{1,2})?$/),credit:z.string().regex(/^\d+(\.\d{1,2})?$/),memo:z.string().max(300).optional()}).refine(e=>(Number(e.debit)>0)!==(Number(e.credit)>0),{message:"Each journal line must have exactly one non-zero side"})).min(2).max(20)}).parse(req.body);const dr=b.entries.reduce((s,x)=>s+Number(x.debit),0),cr=b.entries.reduce((s,x)=>s+Number(x.credit),0);if(Math.abs(dr-cr)>.005||dr<=0)throw new HttpError(400,"UNBALANCED_VOUCHER","يجب تساوي إجمالي المدين والدائن");const accountTypes=await prisma.ledgerAccount.findMany({where:{id:{in:b.entries.map(e=>e.accountId)}},select:{id:true,type:true}});if(accountTypes.length!==new Set(b.entries.map(e=>e.accountId.toString())).size)throw new HttpError(400,"INVALID_LEDGER_ACCOUNT","يوجد حساب غير موجود أو غير مكرر بشكل صحيح");const types=new Map(accountTypes.map(a=>[a.id.toString(),a.type]));if(b.type==="receipt"&&(!b.entries.some(e=>Number(e.debit)>0&&types.get(e.accountId.toString())==="asset")||!b.entries.some(e=>Number(e.credit)>0&&types.get(e.accountId.toString())!=="asset")))throw new HttpError(400,"INVALID_RECEIPT_VOUCHER","سند القبض يجب أن يزيد أصلًا ويقابل التزامًا أو إيرادًا");if(b.type==="payment"&&(!b.entries.some(e=>Number(e.credit)>0&&types.get(e.accountId.toString())==="asset")||!b.entries.some(e=>Number(e.debit)>0&&types.get(e.accountId.toString())!=="asset")))throw new HttpError(400,"INVALID_PAYMENT_VOUCHER","سند الصرف يجب أن يخفض أصلًا ويقابل مصروفًا أو التزامًا");const row=await prisma.journalVoucher.create({data:{voucherNo:`JV-${Date.now()}`,type:b.type,description:b.description,createdBy:BigInt(req.user.sub),entries:{create:b.entries.map(e=>({...e}))}},include:{entries:{include:{account:true}}}});return reply.code(201).send(row);});
 app.get("/accounting/reset-preview",async()=>{
  const [vouchers,entries,totals]=await Promise.all([prisma.journalVoucher.count(),prisma.journalEntry.count(),prisma.journalEntry.aggregate({_sum:{debit:true,credit:true}})]);
  return {vouchers,entries,debit:totals._sum.debit?.toFixed(2)??"0.00",credit:totals._sum.credit?.toFixed(2)??"0.00",scope:"journal_vouchers_and_entries_only"};
 });
 app.post("/accounting/reset",async(req)=>{
  const input=z.object({confirmation:z.literal("مسح القيود المحاسبية نهائيًا"),reason:z.string().trim().min(10).max(300)}).parse(req.body);
  const actor=BigInt(req.user.sub);
  return prisma.$transaction(async tx=>{
   await tx.$executeRaw`LOCK TABLE journal_vouchers IN ACCESS EXCLUSIVE MODE`;
   const [voucherCount,entryCount]=await Promise.all([tx.journalVoucher.count(),tx.journalEntry.count()]);
   await tx.journalVoucher.deleteMany({});
   await tx.auditLog.create({data:{actorId:actor,action:"accounting_ledger_reset",entity:"journal_vouchers",meta:JSON.stringify({voucherCount,entryCount,reason:input.reason,scope:"journal_vouchers_and_entries_only"}),ip:req.ip}});
   return {deletedVouchers:voucherCount,deletedEntries:entryCount};
  },{timeout:30000});
 });
 app.get("/accounting/year-close",async()=>prisma.journalVoucher.findMany({where:{voucherNo:{startsWith:"JV-CLOSE-"}},select:{id:true,voucherNo:true,date:true,description:true,createdAt:true},orderBy:{date:"desc"},take:100}));
 app.post("/accounting/year-close",async(req,reply)=>{
  const {year}=z.object({year:z.number().int().min(1900).max(9998)}).parse(req.body);
  if(year>=new Date().getUTCFullYear())throw new HttpError(400,"FISCAL_YEAR_NOT_FINISHED","يمكن إقفال سنة مالية مكتملة فقط");
  const actor=BigInt(req.user.sub),voucherNo=`JV-CLOSE-${year}`,closeDate=new Date(Date.UTC(year,11,31));
  const row=await prisma.$transaction(async tx=>{
   if(await tx.journalVoucher.findUnique({where:{voucherNo}}))throw new HttpError(409,"FISCAL_YEAR_ALREADY_CLOSED","السنة المالية مقفلة بالفعل");
   const grouped=await tx.journalEntry.groupBy({by:["accountId"],where:{account:{type:{in:["revenue","expense"]}},voucher:{date:{lte:closeDate}}},_sum:{debit:true,credit:true}});
   const accounts=await tx.ledgerAccount.findMany({where:{id:{in:grouped.map(x=>x.accountId)}},select:{id:true,code:true,type:true}});
   const accountMap=new Map(accounts.map(a=>[a.id.toString(),a]));
   const closingEntries:{accountId:bigint;debit:Prisma.Decimal;credit:Prisma.Decimal;memo:string}[]=[];
   let netIncome=new Prisma.Decimal(0);
   for(const balance of grouped){
    const account=accountMap.get(balance.accountId.toString());if(!account)continue;
    const net=new Prisma.Decimal(balance._sum.debit??0).sub(balance._sum.credit??0);if(net.isZero())continue;
    netIncome=netIncome.add(net);
    closingEntries.push({accountId:account.id,debit:net.isNegative()?net.abs():new Prisma.Decimal(0),credit:net.isPositive()?net:new Prisma.Decimal(0),memo:`إقفال ${account.code} ${year}`});
   }
   if(!closingEntries.length)throw new HttpError(409,"NO_PROFIT_LOSS_BALANCES","لا توجد أرصدة إيرادات أو مصروفات لإقفالها");
   let retained=await tx.ledgerAccount.findUnique({where:{code:"3100"}});
   if(retained&&retained.type!=="equity")throw new HttpError(409,"RETAINED_EARNINGS_ACCOUNT_INVALID","الحساب 3100 موجود بنوع غير حقوق الملكية");
   if(!retained)retained=await tx.ledgerAccount.create({data:{code:"3100",name:"الأرباح المحتجزة",type:"equity"}});
   if(netIncome.isPositive())closingEntries.push({accountId:retained.id,debit:new Prisma.Decimal(0),credit:netIncome,memo:`صافي أرباح حتى ${year}`});
   if(netIncome.isNegative())closingEntries.push({accountId:retained.id,debit:netIncome.abs(),credit:new Prisma.Decimal(0),memo:`صافي خسائر حتى ${year}`});
   const debit=closingEntries.reduce((sum,e)=>sum.add(e.debit),new Prisma.Decimal(0)),credit=closingEntries.reduce((sum,e)=>sum.add(e.credit),new Prisma.Decimal(0));
   if(!debit.equals(credit))throw new HttpError(500,"UNBALANCED_YEAR_CLOSE","تعذر إنشاء قيد إقفال متوازن");
   return tx.journalVoucher.create({data:{voucherNo,type:"journal",date:closeDate,description:`إقفال السنة المالية ${year} وترحيل صافي النتيجة إلى الأرباح المحتجزة`,createdBy:actor,entries:{create:closingEntries}},include:{entries:{include:{account:true}}}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
  return reply.code(201).send(row);
 }); app.get("/stock/item-movements/:variantId",async(req)=>{const {variantId}=z.object({variantId:z.string().regex(/^\d+$/).transform(BigInt)}).parse(req.params);return prisma.stockMovement.findMany({where:{variantId},include:{warehouse:true},orderBy:{createdAt:"desc"},take:500});});
};export default plugin;
