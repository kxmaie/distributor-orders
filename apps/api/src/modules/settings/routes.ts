import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/db";
import { HttpError } from "../../lib/errors";

const UnitBody = z.object({ name: z.string().trim().min(1).max(20).regex(/^[a-zA-Z0-9_-]+$/), label: z.string().trim().min(1).max(40) });
const LimitBody = z.object({ maxOrderItems: z.number().int().min(1).max(50) });
const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/units", { preHandler: app.authenticate }, async () => prisma.productUnit.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, select: { id: true, name: true, label: true } }));
  app.get("/admin/settings/order-limit", { preHandler: app.requireRole("admin", "super_admin") }, async () => {
    const row = await prisma.appSetting.findUnique({ where: { key: "max_order_items" } });
    return { maxOrderItems: Number(row?.value ?? 20) };
  });
  app.put("/admin/settings/order-limit", { preHandler: app.requireRole("admin", "super_admin") }, async (req) => {
    const { maxOrderItems } = LimitBody.parse(req.body);
    await prisma.appSetting.upsert({ where: { key: "max_order_items" }, create: { key: "max_order_items", value: String(maxOrderItems) }, update: { value: String(maxOrderItems) } });
    return { maxOrderItems };
  });
  app.get("/admin/settings/units", { preHandler: app.requireRole("super_admin") }, async () => prisma.productUnit.findMany({ orderBy: [{ isActive: "desc" }, { id: "asc" }] }));
  app.post("/admin/settings/units", { preHandler: app.requireRole("super_admin") }, async (req, reply) => {
    const row = await prisma.productUnit.create({ data: UnitBody.parse(req.body) });
    return reply.code(201).send(row);
  });
  app.delete("/admin/settings/units/:id", { preHandler: app.requireRole("super_admin") }, async (req, reply) => {
    const id = z.coerce.number().int().positive().parse((req.params as { id: string }).id);
    const unit = await prisma.productUnit.findUnique({ where: { id } });
    if (!unit) throw new HttpError(404, "UNIT_NOT_FOUND");
    const used = await prisma.product.count({ where: { unit: unit.name } });
    if (used) { await prisma.productUnit.update({ where: { id }, data: { isActive: false } }); return { deactivated: true }; }
    await prisma.productUnit.delete({ where: { id } });
    return reply.code(204).send();
  });
};
export default settingsRoutes;