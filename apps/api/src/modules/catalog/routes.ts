import type { FastifyPluginAsync } from "fastify";
import { CatalogListQuery, IdParam } from "@do/shared";
import * as svc from "./service";

const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate); // B2B: prices only after login

  app.get("/supplier/inventory", { preHandler: app.requireRole("supplier") }, async (req) => {
    const q = CatalogListQuery.parse(req.query);
    return svc.listInventory(q);
  });

  app.get("/categories", { preHandler: app.requireRole("distributor", "admin", "super_admin") }, async () => svc.listCategories());

  app.get("/products", { preHandler: app.requireRole("distributor", "admin", "super_admin") }, async (req) => {
    const q = CatalogListQuery.parse(req.query);
    return svc.listProducts(q, await svc.getUserDiscount(BigInt(req.user.sub)));
  });

  app.get("/products/:id", { preHandler: app.requireRole("distributor", "admin", "super_admin") }, async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.getProduct(id, await svc.getUserDiscount(BigInt(req.user.sub)));
  });
};

export default catalogRoutes;
