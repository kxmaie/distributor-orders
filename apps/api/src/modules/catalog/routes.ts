import type { FastifyPluginAsync } from "fastify";
import { CatalogListQuery, IdParam } from "@do/shared";
import * as svc from "./service";

const catalogRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", app.authenticate); // B2B: prices only after login

  app.get("/categories", async () => svc.listCategories());

  app.get("/products", async (req) => {
    const q = CatalogListQuery.parse(req.query);
    return svc.listProducts(q, await svc.getUserDiscount(BigInt(req.user.sub)));
  });

  app.get("/products/:id", async (req) => {
    const { id } = IdParam.parse(req.params);
    return svc.getProduct(id, await svc.getUserDiscount(BigInt(req.user.sub)));
  });
};

export default catalogRoutes;
