import "./lib/json"; // BigInt -> JSON string
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { config } from "./config";
import { HttpError } from "./lib/errors";
import authPlugin from "./plugins/auth";
import authRoutes from "./modules/auth/routes";
import catalogRoutes from "./modules/catalog/routes";
import adminCatalogRoutes from "./modules/catalog/admin.routes";
import stockRoutes from "./modules/stock/routes";
import purchasesRoutes from "./modules/stock/purchases.routes";
import orderRoutes from "./modules/orders/routes";
import adminOrderRoutes from "./modules/orders/admin.routes";
import adminUserRoutes from "./modules/users/routes";
import adminDiscountRoutes from "./modules/discounts/routes";
import adminReportRoutes from "./modules/reports/routes";
import eventsRoutes from "./modules/events/routes";
import accountRoutes from "./modules/accounts/routes";
import assistantRoutes from "./modules/assistant/routes";
import settingsRoutes from "./modules/settings/routes";
import companyRoutes from "./modules/settings/company.routes";
import { startWorker } from "./lib/worker";

export async function buildApp() {
  const app = Fastify({ logger: config.NODE_ENV !== "test", trustProxy: true });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(","),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  });
  await app.register(cookie);
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(rateLimit, { global: true, max: 200, timeWindow: "1 minute" });
  await app.register(authPlugin);

  // Ensure all JSON responses carry an explicit UTF-8 charset for Arabic clients.
  app.addHook("onSend", async (_req, reply) => {
    const ct = reply.getHeader("content-type");
    if (typeof ct === "string" && ct.includes("application/json") && !ct.includes("charset")) {
      reply.header("content-type", "application/json; charset=utf-8");
    }
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: "VALIDATION", issues: err.issues });
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.code, message: err.message, details: err.details });
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return reply.code(409).send({ error: "CONFLICT", message: "Duplicate value" });
      if (err.code === "P2025") return reply.code(404).send({ error: "NOT_FOUND" });
      if (err.code === "P2003") return reply.code(400).send({ error: "INVALID_REFERENCE" });
    }
    if ((err as { statusCode?: number }).statusCode === 429) return reply.code(429).send({ error: "RATE_LIMITED" });
    app.log.error(err);
    return reply.code(500).send({ error: "INTERNAL" });
  });

  app.get("/health", async () => ({ ok: true }));
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(catalogRoutes, { prefix: "/api/v1" });
  await app.register(adminCatalogRoutes, { prefix: "/api/v1/admin" });
  await app.register(stockRoutes, { prefix: "/api/v1/admin/stock" });
  await app.register(purchasesRoutes, { prefix: "/api/v1/admin" });
  await app.register(orderRoutes, { prefix: "/api/v1" });
  await app.register(adminOrderRoutes, { prefix: "/api/v1/admin" });
  await app.register(adminUserRoutes, { prefix: "/api/v1/admin" });
  await app.register(adminDiscountRoutes, { prefix: "/api/v1/admin" });
  await app.register(adminReportRoutes, { prefix: "/api/v1/admin" });
  await app.register(eventsRoutes, { prefix: "/api/v1" });
  await app.register(accountRoutes, { prefix: "/api/v1" });
  await app.register(assistantRoutes, { prefix: "/api/v1" });
  await app.register(settingsRoutes, { prefix: "/api/v1" });
  await app.register(companyRoutes, { prefix: "/api/v1" });

  // Start the background notification worker after the app is built
  // (skipped on Vercel: serverless functions can't run background jobs)
  if (config.NODE_ENV !== "test" && !process.env.VERCEL) startWorker();

  return app;
}
