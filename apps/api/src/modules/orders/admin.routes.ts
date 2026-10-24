import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AdminOrderListQuery, CreateDeliveryBody, IdParam, StatusChangeBody } from "@do/shared";
import * as svc from "./service";

const AdminEditBody = z.object({ items: z.array(z.object({ variantId: z.string().regex(/^\d+$/).transform((value) => BigInt(value)), qty: z.number().int().min(1).max(100000) })).min(1).max(100), adminDiscount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/) });

const adminOrderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("admin", "super_admin"));

  app.get("/orders", async (req) => svc.listAllOrders(AdminOrderListQuery.parse(req.query)));
  app.get("/orders/board", async () => svc.listBoard());

  app.post("/orders/:id/deliveries", async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.recordDelivery(id, CreateDeliveryBody.parse(req.body), BigInt(req.user.sub), req.ip);
  });

  app.patch("/orders/:id", async (req) => { const { id } = IdParam.parse(req.params); return svc.adminEditOrder(id, AdminEditBody.parse(req.body), BigInt(req.user.sub), req.ip); });

  app.get("/orders/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.getOrder(id, { admin: true });
  });

  app.patch("/orders/:id/status", async (req) => {
    const { id } = IdParam.parse(req.params);
    const b = StatusChangeBody.parse(req.body);
    return svc.adminChangeStatus(id, b.status, BigInt(req.user.sub), b.note, req.ip, req.user.role as "admin" | "super_admin");
  });
};

export default adminOrderRoutes;
