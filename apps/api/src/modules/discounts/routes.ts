import type { FastifyPluginAsync } from "fastify";
import { DiscountCreate, DiscountListQuery, DiscountUpdate, IdParam } from "@do/shared";
import * as svc from "./service";

const adminDiscountRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("admin", "super_admin"));

  app.get("/discounts", async (req) => {
    return svc.listDiscounts(DiscountListQuery.parse(req.query));
  });

  app.post("/discounts", async (req, reply) => {
    const body = DiscountCreate.parse(req.body);
    const item = await svc.createDiscount(body, BigInt(req.user.sub), req.ip);
    return reply.code(201).send(item);
  });

  app.patch("/discounts/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    const body = DiscountUpdate.parse(req.body);
    return svc.updateDiscount(id, body, BigInt(req.user.sub), req.ip);
  });

  app.delete("/discounts/:id", async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    await svc.deleteDiscount(id, BigInt(req.user.sub), req.ip);
    return reply.code(204).send();
  });
};

export default adminDiscountRoutes;
