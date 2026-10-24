import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/db";
import { audit } from "../../lib/audit";

const CompanyProfileBody = z.object({
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().max(300).nullable(),
  taxNumber: z.string().trim().max(80).nullable(),
  commercialRegister: z.string().trim().max(80).nullable(),
  phone: z.string().trim().max(30).nullable(),
  logoUrl: z.string().url().max(500).nullable(),
});
const companyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/company-profile", { preHandler: app.authenticate }, async () =>
    prisma.companyProfile.findUniqueOrThrow({ where: { id: 1 } }),
  );
  app.put("/admin/company-profile", { preHandler: app.requireRole("super_admin") }, async (req) => {
    const data = CompanyProfileBody.parse(req.body);
    const profile = await prisma.companyProfile.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    await audit(BigInt(req.user.sub), "company_profile.update", "company_profile", 1, {
      name: profile.name, taxNumber: profile.taxNumber, commercialRegister: profile.commercialRegister,
    }, req.ip);
    return profile;
  });
};
export default companyRoutes;
