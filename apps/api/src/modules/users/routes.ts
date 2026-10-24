import type { FastifyPluginAsync } from "fastify";
import { IdParam, PasswordRequestQuery, PasswordResolveBody, UserApproveBody, UserCreate, UserListQuery, UserUpdate } from "@do/shared";
import * as svc from "./service";

const adminUserRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.requireRole("super_admin"));

  // ---------- Pending registrations ----------
  app.get("/users/pending", async (req) => {
    return svc.listPendingUsers(UserListQuery.parse(req.query));
  });

  app.post("/users/:id/approve", async (req) => {
    const { id } = IdParam.parse(req.params);
    const body = UserApproveBody.parse(req.body);
    return svc.approveUser(id, body, BigInt(req.user.sub), req.ip);
  });

  app.post("/users/:id/reject", async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    await svc.rejectUser(id, BigInt(req.user.sub), req.ip);
    return reply.code(204).send();
  });

  // Users CRUD
  app.get("/users", async (req) => {
    return svc.listUsers(UserListQuery.parse(req.query));
  });

  app.post("/users", async (req, reply) => {
    const body = UserCreate.parse(req.body);
    const user = await svc.createUser(body, BigInt(req.user.sub), req.ip);
    return reply.code(201).send(user);
  });

  app.get("/users/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.getUser(id);
  });

  app.patch("/users/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    const body = UserUpdate.parse(req.body);
    return svc.updateUser(id, body, BigInt(req.user.sub), req.ip);
  });

  app.delete("/users/:id", async (req, reply) => {
    const { id } = IdParam.parse(req.params);
    await svc.deleteUser(id, BigInt(req.user.sub), req.ip);
    return reply.code(204).send();
  });

  // Password requests
  app.get("/password-requests", async (req) => {
    return svc.listPasswordRequests(PasswordRequestQuery.parse(req.query));
  });

  app.post("/password-requests/:id/resolve", async (req) => {
    const { id } = IdParam.parse(req.params);
    const body = PasswordResolveBody.parse(req.body);
    return svc.resolvePasswordRequest(id, body, BigInt(req.user.sub), req.ip);
  });
};

export default adminUserRoutes;
