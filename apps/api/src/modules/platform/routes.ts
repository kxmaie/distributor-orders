import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { config, isProd } from "../../config";
import { HttpError } from "../../lib/errors";
import { dummyVerify, verifyPassword } from "../../lib/password";
import { listPlatformBackups, listPlatformTenants, registerPlatformTenant, setPlatformTenantStatus } from "../../lib/tenant-registry";

const COOKIE = "platform_session";
const SESSION_SECONDS = 8 * 60 * 60;
const cookieOptions = { httpOnly: true, secure: isProd, sameSite: (isProd ? "none" : "lax") as "none" | "lax", path: "/api/v1/platform", maxAge: SESSION_SECONDS };
type PlatformSession = { sub: string; exp: number };

function configured() {
  return Boolean(config.PLATFORM_ADMIN_USERNAME && config.PLATFORM_ADMIN_PASSWORD_HASH && config.PLATFORM_SESSION_SECRET && process.env.CONTROL_DATABASE_URL && process.env.TENANT_ENCRYPTION_KEY);
}
function unavailable() {
  if (!configured()) throw new HttpError(503, "PLATFORM_NOT_CONFIGURED", "إعداد إدارة المنصة غير مكتمل؛ راجع إعدادات أسرار المنصة وقاعدة التحكم");
}
function signSession(username: string) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS } satisfies PlatformSession)).toString("base64url");
  const signature = createHmac("sha256", config.PLATFORM_SESSION_SECRET!).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}
function parseSession(token: string | undefined): PlatformSession | null {
  if (!token || !config.PLATFORM_SESSION_SECRET) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", config.PLATFORM_SESSION_SECRET).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PlatformSession;
    if (session.sub !== config.PLATFORM_ADMIN_USERNAME || !Number.isFinite(session.exp) || session.exp <= Date.now() / 1000) return null;
    return session;
  } catch { return null; }
}
function requirePlatformSession(req: FastifyRequest) {
  unavailable();
  const session = parseSession(req.cookies[COOKIE]);
  if (!session) throw new HttpError(401, "PLATFORM_UNAUTHORIZED", "سجّل الدخول إلى لوحة المنصة");
  return session;
}

const platformRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, async (req, reply) => {
    unavailable();
    const body = z.object({ username: z.string().min(1).max(80), password: z.string().min(1).max(256) }).parse(req.body);
    const username = body.username.trim();
    const validUser = username.toLowerCase() === config.PLATFORM_ADMIN_USERNAME!.toLowerCase();
    const validPassword = validUser
      ? await verifyPassword(config.PLATFORM_ADMIN_PASSWORD_HASH!, body.password)
      : (await dummyVerify(body.password), false);
    if (!validUser || !validPassword) throw new HttpError(401, "PLATFORM_LOGIN_INVALID", "بيانات دخول مالك المنصة غير صحيحة");
    reply.setCookie(COOKIE, signSession(config.PLATFORM_ADMIN_USERNAME!), cookieOptions);
    return { username: config.PLATFORM_ADMIN_USERNAME, expiresIn: SESSION_SECONDS };
  });

  app.post("/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE, { path: cookieOptions.path });
    return reply.code(204).send();
  });

  app.get("/session", async (req) => ({ username: requirePlatformSession(req).sub }));
  app.get("/tenants", async (req) => {
    requirePlatformSession(req);
    if (config.TENANCY_MODE !== "multi") throw new HttpError(503, "TENANCY_DISABLED", "إدارة قواعد العملاء متاحة بعد تجهيز وضع تعدد العملاء");
    return listPlatformTenants();
  });
  app.post("/tenants", async (req, reply) => {
    const session = requirePlatformSession(req);
    if (config.TENANCY_MODE !== "multi") throw new HttpError(503, "TENANCY_DISABLED", "إدارة قواعد العملاء متاحة بعد تجهيز وضع تعدد العملاء");
    const body = z.object({ slug: z.string().min(1).max(63), name: z.string().min(1).max(120), databaseUrl: z.string().min(1).max(4096) }).parse(req.body);
    const tenant = await registerPlatformTenant(body, session.sub);
    return reply.code(201).send(tenant);
  });
  app.patch("/tenants/:slug/status", async (req) => {
    const session = requirePlatformSession(req);
    if (config.TENANCY_MODE !== "multi") throw new HttpError(503, "TENANCY_DISABLED");
    const { slug } = z.object({ slug: z.string().min(1).max(63) }).parse(req.params);
    const { status } = z.object({ status: z.enum(["active", "suspended"]) }).parse(req.body);
    const tenant = await setPlatformTenantStatus(slug, status, session.sub);
    if (!tenant) throw new HttpError(404, "TENANT_NOT_FOUND");
    return tenant;
  });
  app.get("/backups", async (req) => {
    requirePlatformSession(req);
    if (config.TENANCY_MODE !== "multi") throw new HttpError(503, "TENANCY_DISABLED");
    return listPlatformBackups();
  });
};
export default platformRoutes;
