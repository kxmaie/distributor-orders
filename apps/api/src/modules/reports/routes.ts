import type { FastifyPluginAsync } from "fastify";
import { ReportsQuery } from "@do/shared";
import { generateText, gateway, type GatewayModelId } from "ai";
import { z } from "zod";
import { HttpError } from "../../lib/errors";
import * as svc from "./service";
import { prisma } from "../../lib/db";

const adminReportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("super_admin"));

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
  });  app.get("/reports/purchases", async () => {
    const [bought, returned, purchaseCount, returnCount] = await Promise.all([
      prisma.purchase.aggregate({ where: { voidedAt: null }, _sum: { total: true }, _count: true }),
      prisma.purchaseReturn.aggregate({ where: { purchase: { voidedAt: null } }, _sum: { total: true }, _count: true }),
      prisma.purchase.count({ where: { voidedAt: null } }),
      prisma.purchaseReturn.count({ where: { purchase: { voidedAt: null } } }),
    ]);
    const gross = Number(bought._sum.total ?? 0), returns = Number(returned._sum.total ?? 0);
    return { grossPurchases: gross.toFixed(2), purchaseReturns: returns.toFixed(2), netPurchases: (gross - returns).toFixed(2), purchaseCount, returnCount };
  });
  app.get("/reports/accounting/trial-balance", async () => {
    const accounts = await prisma.ledgerAccount.findMany({ where: { isActive: true }, include: { entries: { select: { debit: true, credit: true } } }, orderBy: { code: "asc" } });
    return accounts.map(a => ({ id: a.id, code: a.code, name: a.name, type: a.type, debit: a.entries.reduce((s,e)=>s+Number(e.debit),0).toFixed(2), credit: a.entries.reduce((s,e)=>s+Number(e.credit),0).toFixed(2) }));
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
