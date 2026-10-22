import type { FastifyPluginAsync } from "fastify";
import { ReportsQuery } from "@do/shared";
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
};

export default adminReportRoutes;