import type { FastifyPluginAsync } from "fastify";
import { ReportsQuery } from "@do/shared";
import { generateText, gateway, type GatewayModelId } from "ai";
import { z } from "zod";
import { HttpError } from "../../lib/errors";
import * as svc from "./service";

const adminReportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("admin", "super_admin"));

  app.get("/reports/dashboard", async () => {
    return svc.getDashboardSummary();
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
