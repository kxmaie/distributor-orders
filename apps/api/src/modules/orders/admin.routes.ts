import type { FastifyPluginAsync } from "fastify";
import { AdminOrderListQuery, CreateDeliveryBody, IdParam, StatusChangeBody } from "@do/shared";
import * as svc from "./service";

const adminOrderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("admin", "super_admin"));

  app.get("/orders", async (req) => svc.listAllOrders(AdminOrderListQuery.parse(req.query)));
  app.get("/orders/board", async () => svc.listBoard());

  app.post("/orders/:id/deliveries", async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.recordDelivery(id, CreateDeliveryBody.parse(req.body), BigInt(req.user.sub), req.ip);
  });

  app.get("/orders/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.getOrder(id, { admin: true });
  });

  app.patch("/orders/:id/status", async (req) => {
    const { id } = IdParam.parse(req.params);
    const b = StatusChangeBody.parse(req.body);
    return svc.adminChangeStatus(id, b.status, BigInt(req.user.sub), b.note, req.ip);
  });
};

export default adminOrderRoutes;
