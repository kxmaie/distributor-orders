import type { FastifyPluginAsync } from "fastify";
import { ReportsQuery } from "@do/shared";
import { generateText, gateway, type GatewayModelId } from "ai";
import { z } from "zod";
import { HttpError } from "../../lib/errors";
import * as svc from "./service";
import { prisma } from "../../lib/db";

const adminReportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("super_admin"));

  app.get("/reports/audit-log", async (req) => {
    const q = z.object({ from: z.string().date().optional(), to: z.string().date().optional(), q: z.string().trim().max(120).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50) })
      .refine((value) => !value.from || !value.to || value.from <= value.to, { message: "Invalid date range" }).parse(req.query);
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (q.from) createdAt.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) createdAt.lte = new Date(`${q.to}T23:59:59.999Z`);
    const actorIds = q.q
      ? (await prisma.user.findMany({ where: { OR: [{ fullName: { contains: q.q, mode: "insensitive" } }, { username: { contains: q.q, mode: "insensitive" } }] }, select: { id: true } })).map((user) => user.id)
      : [];
    const where = {
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(q.q ? { OR: [
        { action: { contains: q.q, mode: "insensitive" as const } },
        { entity: { contains: q.q, mode: "insensitive" as const } },
        { entityId: { contains: q.q, mode: "insensitive" as const } },
        { meta: { contains: q.q, mode: "insensitive" as const } },
        ...(actorIds.length ? [{ actorId: { in: actorIds } }] : []),
      ] } : {}),
    };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      prisma.auditLog.count({ where }),
    ]);
    const users = await prisma.user.findMany({ where: { id: { in: [...new Set(logs.map((row) => row.actorId).filter((id): id is bigint => id !== null))] } }, select: { id: true, fullName: true, username: true } });
    const actors = new Map(users.map((user) => [user.id.toString(), { fullName: user.fullName, username: user.username }]));
    return {
      items: logs.map((row) => {
        let meta: unknown = row.meta;
        if (row.meta) { try { meta = JSON.parse(row.meta); } catch { /* retain legacy plain-text metadata */ } }
        return { id: row.id.toString(), actor: row.actorId ? actors.get(row.actorId.toString()) ?? null : null, action: row.action, entity: row.entity, entityId: row.entityId, meta, ip: row.ip, createdAt: row.createdAt.toISOString() };
      }),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  });
  app.get("/reports/dashboard", async () => {
    return svc.getDashboardSummary();
  });

  app.get("/reports/profit-loss", async () => {
    const [purchases, purchaseReturns, deliveries, salesReturns, purchaseTotal, purchaseReturnTotal] = await Promise.all([
      prisma.purchaseItem.groupBy({ by: ["variantId"], where: { purchase: { voidedAt: null } }, _sum: { qty: true, lineTotal: true } }),
      prisma.purchaseReturnItem.groupBy({ by: ["variantId"], where: { purchaseReturn: { purchase: { voidedAt: null } } }, _sum: { qty: true, lineTotal: true } }),
      prisma.deliveryItem.findMany({ include: { orderItem: { select: { variantId: true } } } }),
      prisma.salesReturnItem.findMany({ include: { orderItem: { select: { variantId: true } } } }),
      prisma.purchase.aggregate({ where: { voidedAt: null }, _sum: { total: true } }),
      prisma.purchaseReturn.aggregate({ where: { purchase: { voidedAt: null } }, _sum: { total: true } }),
    ]);
    const returnedByVariant=new Map(purchaseReturns.map(r=>[r.variantId.toString(),{qty:r._sum.qty??0,total:Number(r._sum.lineTotal??0)}]));
    const costs = new Map(purchases.map((row) => {const ret=returnedByVariant.get(row.variantId.toString());const qty=(row._sum.qty??0)-(ret?.qty??0);const total=Number(row._sum.lineTotal??0)-(ret?.total??0);return [row.variantId.toString(),qty>0?total/qty:0] as const;}));
    const deliveredRevenue=deliveries.reduce((sum,row)=>sum+Number(row.amount),0);const returnRevenue=salesReturns.reduce((sum,row)=>sum+Number(row.lineTotal),0);const revenue=deliveredRevenue-returnRevenue;
    let cost=0,returnedCost=0,uncostedQty=0;
    for(const row of deliveries){const unitCost=costs.get(row.orderItem.variantId.toString());if(unitCost===undefined)uncostedQty+=row.qty;else cost+=unitCost*row.qty;}
    for(const row of salesReturns){const unitCost=costs.get(row.orderItem.variantId.toString());if(unitCost!==undefined)returnedCost+=unitCost*row.qty;}
    cost=Math.max(0,cost-returnedCost);const grossPurchases=Number(purchaseTotal._sum.total??0),returns=Number(purchaseReturnTotal._sum.total??0);
    return { revenue: revenue.toFixed(2), costOfGoodsSold: cost.toFixed(2), grossProfit: (revenue-cost).toFixed(2), purchasesTotal:(grossPurchases-returns).toFixed(2), uncostedQty, costingMethod:"weighted_average_net_of_returns" };
  });  app.get("/reports/purchases", async (req) => {
    const q = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).refine(v => !v.from || !v.to || v.from <= v.to, { message: "Invalid date range" }).parse(req.query);
    const range: { gte?: Date; lte?: Date } = {};
    if (q.from) range.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) range.lte = new Date(`${q.to}T23:59:59.999Z`);
    const where = Object.keys(range).length ? { createdAt: range } : {};
    const [purchases, returns] = await Promise.all([
      prisma.purchase.findMany({ where: { ...where, voidedAt: null }, include: { items: { include: { variant: { include: { product: true } }, warehouse: true } } }, orderBy: { createdAt: "desc" }, take: 2000 }),
      prisma.purchaseReturn.findMany({ where: { ...where, purchase: { voidedAt: null } }, include: { purchase: { select: { invoiceNo: true } }, items: { include: { variant: { include: { product: true } }, warehouse: true } } }, orderBy: { createdAt: "desc" }, take: 2000 }),
    ]);
    const gross = purchases.reduce((sum, row) => sum + Number(row.total), 0), returned = returns.reduce((sum, row) => sum + Number(row.total), 0);
    return { summary: { grossPurchases: gross.toFixed(2), purchaseReturns: returned.toFixed(2), netPurchases: (gross - returned).toFixed(2), purchaseCount: purchases.length, returnCount: returns.length }, invoices: purchases.map(row => ({ id: row.id.toString(), kind: "purchase", number: row.invoiceNo, supplier: row.supplier, date: row.createdAt.toISOString(), total: row.total.toString(), items: row.items.map(i => ({ product: i.variant.product.name, variant: i.variant.label, qty: i.qty, unitCost: i.unitCost.toString(), total: i.lineTotal.toString(), warehouse: i.warehouse.name })) })), returns: returns.map(row => ({ id: row.id.toString(), kind: "return", number: row.returnNo, supplier: row.supplier, invoiceNo: row.purchase.invoiceNo, date: row.createdAt.toISOString(), total: row.total.toString(), items: row.items.map(i => ({ product: i.variant.product.name, variant: i.variant.label, qty: i.qty, unitCost: i.unitCost.toString(), total: i.lineTotal.toString(), warehouse: i.warehouse.name })) })) };
  });
  app.get("/reports/returns/sales", async (req) => {
    const q = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).refine(v => !v.from || !v.to || v.from <= v.to, { message: "Invalid date range" }).parse(req.query);
    const date: { gte?: Date; lte?: Date } = {};
    if (q.from) date.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) date.lte = new Date(`${q.to}T23:59:59.999Z`);
    const rows = await prisma.salesReturn.findMany({
      where: Object.keys(date).length ? { createdAt: date } : {},
      include: { order: { include: { user: { select: { fullName: true } } } }, items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" }, take: 2000,
    });
    return {
      summary: { count: rows.length, quantity: rows.reduce((sum, row) => sum + row.items.reduce((n, item) => n + item.qty, 0), 0), total: rows.reduce((sum, row) => sum + Number(row.total), 0).toFixed(2) },
      rows: rows.map(row => ({ id: row.id.toString(), number: row.returnNo, invoiceNo: row.order.orderNo, customer: row.order.user.fullName, date: row.createdAt.toISOString(), total: row.total.toString(), items: row.items.map(item => ({ product: item.variant.product.name, variant: item.variant.label, qty: item.qty, unitPrice: item.unitPrice.toString(), total: item.lineTotal.toString() })) })),
    };
  });
  app.get("/reports/returns/purchases", async (req) => {
    const q = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).refine(v => !v.from || !v.to || v.from <= v.to, { message: "Invalid date range" }).parse(req.query);
    const date: { gte?: Date; lte?: Date } = {};
    if (q.from) date.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) date.lte = new Date(`${q.to}T23:59:59.999Z`);
    const rows = await prisma.purchaseReturn.findMany({
      where: { ...(Object.keys(date).length ? { createdAt: date } : {}), purchase: { voidedAt: null } },
      include: { purchase: { select: { invoiceNo: true } }, items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" }, take: 2000,
    });
    return {
      summary: { count: rows.length, quantity: rows.reduce((sum, row) => sum + row.items.reduce((n, item) => n + item.qty, 0), 0), total: rows.reduce((sum, row) => sum + Number(row.total), 0).toFixed(2) },
      rows: rows.map(row => ({ id: row.id.toString(), number: row.returnNo, invoiceNo: row.purchase.invoiceNo, supplier: row.supplier, date: row.createdAt.toISOString(), total: row.total.toString(), items: row.items.map(item => ({ product: item.variant.product.name, variant: item.variant.label, qty: item.qty, unitPrice: item.unitCost.toString(), total: item.lineTotal.toString() })) })),
    };
  });
  app.get("/reports/accounting/trial-balance", async (req) => {
    const q = z.object({ from: z.string().date().optional(), to: z.string().date().optional() }).refine(v => !v.from || !v.to || v.from <= v.to, { message: "Invalid date range" }).parse(req.query);
    const through: { lte?: Date } = {};
    if (q.to) through.lte = new Date(`${q.to}T23:59:59.999Z`);
    const entriesWhere = Object.keys(through).length ? { voucher: { date: through } } : {};
    const accounts = await prisma.ledgerAccount.findMany({ where: { isActive: true }, include: { entries: { where: entriesWhere, select: { debit: true, credit: true, voucher: { select: { date: true } } } } }, orderBy: { code: "asc" } });
    return accounts.map(a => {
      const opening = a.entries.filter(e => q.from && e.voucher.date < new Date(`${q.from}T00:00:00.000Z`));
      const period = a.entries.filter(e => !q.from || e.voucher.date >= new Date(`${q.from}T00:00:00.000Z`));
      const sum = (rows: typeof a.entries, side: "debit" | "credit") => rows.reduce((total,e)=>total+Number(e[side]),0);
      const openingNet = sum(opening,"debit")-sum(opening,"credit");
      const closingNet = sum([...opening,...period],"debit")-sum([...opening,...period],"credit");
      return { id: a.id.toString(), code: a.code, name: a.name, type: a.type, openingDebit: Math.max(0,openingNet).toFixed(2), openingCredit: Math.max(0,-openingNet).toFixed(2), periodDebit: sum(period,"debit").toFixed(2), periodCredit: sum(period,"credit").toFixed(2), closingDebit: Math.max(0,closingNet).toFixed(2), closingCredit: Math.max(0,-closingNet).toFixed(2) };
    });
  });
  app.get("/reports/products", async (req) => {
    const q = z.object({ from: z.string().date().optional(), to: z.string().date().optional(), q: z.string().trim().max(120).optional() }).refine(v => !v.from || !v.to || v.from <= v.to, { message: "Invalid date range" }).parse(req.query);
    const date: { gte?: Date; lte?: Date } = {};
    if (q.from) date.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) date.lte = new Date(`${q.to}T23:59:59.999Z`);
    const deliveryWhere = Object.keys(date).length ? { delivery: { deliveredAt: date } } : {};
    const returnWhere = Object.keys(date).length ? { salesReturn: { createdAt: date } } : {};
    const [variants, deliveries, returns] = await Promise.all([
      prisma.productVariant.findMany({ include: { product: true }, orderBy: { id: "asc" } }),
      prisma.deliveryItem.findMany({ where: deliveryWhere, include: { orderItem: { include: { variant: { include: { product: true } } } } } }),
      prisma.salesReturnItem.findMany({ where: returnWhere, include: { orderItem: { include: { variant: { include: { product: true } } } } } }),
    ]);
    const rows = new Map<string, { product: string; variant: string; sku: string; soldQty: number; returnedQty: number; gross: number; returned: number }>();
    for (const v of variants) rows.set(v.id.toString(), { product: v.product.name, variant: v.label, sku: v.sku, soldQty: 0, returnedQty: 0, gross: 0, returned: 0 });
    for (const item of deliveries) { const v=item.orderItem.variant, id=v.id.toString(), row=rows.get(id)??{product:v.product.name,variant:v.label,sku:v.sku,soldQty:0,returnedQty:0,gross:0,returned:0};row.soldQty+=item.qty;row.gross+=Number(item.amount);rows.set(id,row); }
    for (const item of returns) { const v=item.orderItem.variant,id=v.id.toString(),row=rows.get(id)??{product:v.product.name,variant:v.label,sku:v.sku,soldQty:0,returnedQty:0,gross:0,returned:0};row.returnedQty+=item.qty;row.returned+=Number(item.lineTotal);rows.set(id,row); }
    return [...rows.entries()].map(([variantId,row])=>({variantId,...row,netQty:row.soldQty-row.returnedQty,netSales:(row.gross-row.returned).toFixed(2),grossSales:row.gross.toFixed(2),returns:row.returned.toFixed(2)})).filter(r=>!q.q||`${r.product} ${r.variant} ${r.sku}`.toLocaleLowerCase().includes(q.q.toLocaleLowerCase())).sort((a,b)=>Number(b.netSales)-Number(a.netSales));
  });
  app.get("/reports/inventory", async (req) => {
    const q = z.object({ from: z.string().date().optional(), to: z.string().date().optional(), q: z.string().trim().max(120).optional() }).refine(v => !v.from || !v.to || v.from <= v.to, { message: "Invalid date range" }).parse(req.query);
    const date: { gte?: Date; lte?: Date } = {};
    if (q.from) date.gte = new Date(`${q.from}T00:00:00.000Z`);
    if (q.to) date.lte = new Date(`${q.to}T23:59:59.999Z`);
    const variantSearch = q.q ? { OR: [{ sku: { contains: q.q, mode: "insensitive" as const } }, { label: { contains: q.q, mode: "insensitive" as const } }, { product: { name: { contains: q.q, mode: "insensitive" as const } } }] } : undefined;
    const search = variantSearch ? { variant: variantSearch } : {};
    const moveSearch = variantSearch ? { variant: variantSearch } : {};
    const [stock, movements] = await Promise.all([
      prisma.stockLevel.findMany({ where: { ...search, warehouse: { isActive: true } }, include: { variant: { include: { product: true } }, warehouse: true }, orderBy: [{ variantId: "asc" }, { warehouseId: "asc" }], take: 5000 }),
      prisma.stockMovement.findMany({ where: { ...(Object.keys(date).length ? { createdAt: date } : {}), ...moveSearch }, include: { variant: { include: { product: true } }, warehouse: true }, orderBy: { createdAt: "desc" }, take: 5000 }),
    ]);
    return { stock: stock.map(r=>({variantId:r.variantId.toString(),product:r.variant.product.name,variant:r.variant.label,sku:r.variant.sku,warehouse:r.warehouse.name,onHand:r.onHand,reserved:r.reserved,available:r.onHand-r.reserved,threshold:r.lowStockThreshold})), movements: movements.map(m=>({id:m.id.toString(),product:m.variant.product.name,variant:m.variant.label,sku:m.variant.sku,warehouse:m.warehouse.name,type:m.type,qty:m.qty,note:m.note,createdAt:m.createdAt.toISOString()})) };
  });
  app.get("/reports/sales", async (req) => {
    const q = ReportsQuery.parse(req.query);
    return svc.getSalesReport(q);
  });

  app.post("/reports/ask", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (req) => {
    const { question, from, to } = z.object({
      question: z.string().trim().min(3).max(500),
      from: z.string().date().optional(),
      to: z.string().date().optional(),
    }).parse(req.body);
    const model = process.env.AI_GATEWAY_MODEL?.trim();
    if (!process.env.AI_GATEWAY_API_KEY || !model) {
      throw new HttpError(503, "AI_NOT_CONFIGURED", "AI reporting is not configured yet");
    }
    const report = await svc.getSalesReport({ from, to });
    const { text } = await generateText({
      model: gateway.languageModel(model as GatewayModelId),
      system: "أنت مساعد تقارير لمتجر. أجب بالعربية باختصار اعتمادًا فقط على بيانات الملخص المرفقة. وضح الفترة، وقل صراحة إذا كانت البيانات لا تكفي. لا تكشف بيانات شخصية ولا تخترع أرقامًا أو أسبابًا.",
      prompt: `سؤال المدير: ${question}\nالفترة: ${from ?? "بلا بداية محددة"} — ${to ?? "حتى الآن"}\nالبيانات المجمعة: ${JSON.stringify({ summary: report.summary, statusCounts: report.statusCounts })}`,
      maxOutputTokens: 450,
      temperature: 0.2,
    });
    return { answer: text };
  });
};

export default adminReportRoutes;
