import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";
import type { Role } from "@do/shared";
import { HttpError } from "../lib/errors";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: Role };
    user: { sub: string; role: Role };
  }
}
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest) => Promise<void>;
    requireRole: (...roles: Role[]) => (req: FastifyRequest) => Promise<void>;
  }
}

export default fp(async (app) => {
  const authenticate = async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new HttpError(401, "UNAUTHORIZED");
    }
  };
  app.decorate("authenticate", authenticate);
  app.decorate("requireRole", (...roles: Role[]) => async (req: FastifyRequest) => {
    await authenticate(req);
    if (!roles.includes(req.user.role)) throw new HttpError(403, "FORBIDDEN");
  });
});
