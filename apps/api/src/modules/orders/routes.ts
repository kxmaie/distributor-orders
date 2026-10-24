import type { FastifyPluginAsync } from "fastify";
import { CartPriceBody, CreateOrderBody, IdParam, OrderListQuery } from "@do/shared";
import * as svc from "./service";

const orderRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("distributor"));
  const uid = (req: { user: { sub: string } }) => BigInt(req.user.sub);

  app.post("/cart/price", async (req) => svc.priceCart(uid(req), CartPriceBody.parse(req.body)));

  app.post("/orders", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const order = await svc.createOrder(uid(req), CreateOrderBody.parse(req.body), req.ip);
    return reply.code(201).send(order);
  });

  app.patch("/orders/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.updateOwnOrder(id, uid(req), CreateOrderBody.parse(req.body), req.ip);
  });
  app.get("/orders", async (req) => svc.listMyOrders(uid(req), OrderListQuery.parse(req.query)));

  app.get("/orders/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.getOrder(id, { ownerId: uid(req) });
  });

  app.post("/orders/:id/cancel", async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.cancelOwnOrder(id, uid(req), req.ip);
  });
};

export default orderRoutes;
