import type { FastifyPluginAsync } from "fastify";
import { AccountQuery, CreatePaymentBody, IdParam } from "@do/shared";
import { getStatement, listAccounts, recordPayment } from "./service";

const accountRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate);

  app.get("/account/statement", async (req) => getStatement(BigInt(req.user.sub), AccountQuery.parse(req.query)));

  app.get("/admin/accounts", { preHandler: app.requireRole("admin", "super_admin") }, async () => listAccounts());
  app.get("/admin/accounts/:id/statement", { preHandler: app.requireRole("admin", "super_admin") }, async (req) => {
    const { id } = IdParam.parse(req.params);
    return getStatement(id, AccountQuery.parse(req.query));
  });
  app.post("/admin/accounts/:id/payments", { preHandler: app.requireRole("admin", "super_admin") }, async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    const payment = await recordPayment(id, BigInt(req.user.sub), CreatePaymentBody.parse(req.body), req.ip);
    return reply.code(201).send(payment);
  });
};

export default accountRoutes;
