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
    const [purchases, deliveries] = await Promise.all([
      prisma.purchaseItem.groupBy({ by: ["variantId"], where: { purchase: { voidedAt: null } }, _sum: { qty: true, lineTotal: true } }),
      prisma.deliveryItem.findMany({ include: { orderItem: { select: { variantId: true } } } }),
    ]);
    const costs = new Map(purchases.map((row) => [row.variantId.toString(), Number(row._sum.lineTotal ?? 0) / Math.max(1, row._sum.qty ?? 0)]));
    const revenue = deliveries.reduce((sum, row) => sum + Number(row.amount), 0);
    let cost = 0;
    let uncostedQty = 0;
    for (const row of deliveries) {
      const unitCost = costs.get(row.orderItem.variantId.toString());
      if (unitCost === undefined) uncostedQty += row.qty;
      else cost += unitCost * row.qty;
    }
    const purchased = await prisma.purchase.aggregate({ where: { voidedAt: null }, _sum: { total: true } });
    return { revenue: revenue.toFixed(2), costOfGoodsSold: cost.toFixed(2), grossProfit: (revenue - cost).toFixed(2), purchasesTotal: Number(purchased._sum.total ?? 0).toFixed(2), uncostedQty, costingMethod: "weighted_average" };
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
