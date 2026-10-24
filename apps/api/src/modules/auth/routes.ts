import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { LoginBody, PasswordRequestBody, RegisterBody, RoleSchema, WhatsAppConsentBody } from "@do/shared";
import { ACCESS_TTL, REFRESH_COOKIE, REFRESH_TTL_DAYS, config, isProd } from "../../config";
import * as svc from "./service";

const COOKIE_PATH = "/api/v1/auth";
const cookieOpts = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd && config.DEMO_MODE ? "none" as const : "strict" as const,
  path: COOKIE_PATH,
  maxAge: REFRESH_TTL_DAYS * 86_400,
};

const authRoutes: FastifyPluginAsync = async (app) => {
  const meta = (req: FastifyRequest) => ({ ip: req.ip, userAgent: req.headers["user-agent"] });

  const session = (
    reply: FastifyReply,
    user: Parameters<typeof svc.toPublicUser>[0],
    refreshToken: string,
  ) => {
    const accessToken = app.jwt.sign({ sub: user.id.toString(), role: RoleSchema.parse(user.role) }, { expiresIn: ACCESS_TTL });
    reply.setCookie(REFRESH_COOKIE, refreshToken, cookieOpts);
    return { accessToken, user: svc.toPublicUser(user) };
  };

  app.post("/register", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (req, reply) => {
    const body = RegisterBody.parse(req.body);
    const user = await svc.register(body, req.ip);
    return reply.code(201).send({ ok: true, user, message: "تم تسجيل الحساب بنجاح وهو بانتظار موافقة الإدارة" });
  });

  app.post("/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const body = LoginBody.parse(req.body);
    const { user, refreshToken } = await svc.login(body.username, body.password, meta(req));
    return session(reply, user, refreshToken);
  });

  app.post("/refresh", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (!raw) return reply.code(401).send({ error: "INVALID_REFRESH" });
    try {
      const { user, refreshToken } = await svc.rotate(raw, meta(req));
      return session(reply, user, refreshToken);
    } catch (e) {
      reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
      throw e;
    }
  });

  app.post("/logout", async (req, reply) => {
    await svc.logout(req.cookies[REFRESH_COOKIE]);
    reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    return reply.code(204).send();
  });

  app.post("/password-request", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, async (req, reply) => {
    const body = PasswordRequestBody.parse(req.body);
    await svc.createPasswordRequest(body.username, body.note);
    return reply.code(202).send({ ok: true });
  });

  app.get("/me", { preHandler: app.authenticate }, async (req) => svc.getMe(BigInt(req.user.sub)));
  app.patch("/whatsapp-consent", { preHandler: app.authenticate }, async (req) => {
    const body = WhatsAppConsentBody.parse(req.body);
    return svc.setWhatsAppConsent(BigInt(req.user.sub), body.enabled, req.ip);
  });
};

export default authRoutes;
