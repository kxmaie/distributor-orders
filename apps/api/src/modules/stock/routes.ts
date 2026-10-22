import type { FastifyPluginAsync } from "fastify";
import { MovementQuery, StockAdjustBody, StockListQuery } from "@do/shared";
import * as svc from "./service";

const stockRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("admin", "super_admin"));

  app.get("/", async (req) => svc.listStock(StockListQuery.parse(req.query)));
  app.get("/movements", async (req) => svc.listMovements(MovementQuery.parse(req.query)));
  app.post("/adjust", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (req) =>
    svc.adjustStock(StockAdjustBody.parse(req.body), BigInt(req.user.sub), req.ip),
  );
};

export default stockRoutes;
