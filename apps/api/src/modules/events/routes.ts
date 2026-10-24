/**
 * GET /api/v1/events — Server-Sent Events endpoint.
 *
 * Authentication: JWT sent either as:
 *   - Authorization: Bearer <token>   (standard header)
 *   - ?token=<token>                  (query param, needed when EventSource
 *                                      doesn't support custom headers)
 *
 * The connection is rotated periodically so serverless platforms do not
 * terminate it at their function-duration limit. A ping is sent every 30 s.
 */

import type { FastifyInstance } from "fastify";
import { addClient, removeClient, tenantUserKey } from "../../lib/sse";
import { currentTenant } from "../../lib/tenant-context";

const PING_INTERVAL = 30_000;
// Vercel can terminate a function at 300 seconds. Close cleanly before that;
// the browser client reconnects and triggers its normal resync behavior.
const MAX_CONNECTION_DURATION = 240_000;

export default async function eventsRoutes(app: FastifyInstance) {
  app.get(
    "/events",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      // ── Auth ──────────────────────────────────────────────────────────────
      // Support ?token= query param because browser EventSource cannot set headers.
      const qs = req.query as Record<string, string>;
      const tokenFromQuery = qs?.token;

      if (tokenFromQuery && !req.headers.authorization) {
        req.headers.authorization = `Bearer ${tokenFromQuery}`;
      }

      try {
        await req.jwtVerify();
      } catch {
        return reply.code(401).send({ error: "UNAUTHORIZED" });
      }

      const tenant = currentTenant();
      if (tenant && req.user.tenantId !== tenant.id) return reply.code(401).send({ error: "TENANT_SESSION_MISMATCH" });
      const userId = tenantUserKey(req.user.sub); // isolated per-tenant identity

      // ── SSE headers ───────────────────────────────────────────────────────
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // disable Nginx buffering
      });
      reply.raw.flushHeaders?.();

      // Register with the SSE broker
      const clientId = addClient(userId, reply);

      // Send initial "connected" event
      reply.raw.write(
        `event: connected\ndata: ${JSON.stringify({ userId })}\n\n`,
      );

      // Ping timer
      const ping = setInterval(() => {
        try {
          reply.raw.write(": ping\n\n");
        } catch {
          clearInterval(ping);
        }
      }, PING_INTERVAL);

      const rotate = setTimeout(() => {
        reply.raw.end();
      }, MAX_CONNECTION_DURATION);

      // Clean up on disconnect
      req.raw.on("close", () => {
        clearInterval(ping);
        clearTimeout(rotate);
        removeClient(userId, clientId);
      });

      // Keep the handler promise pending (Fastify must not close the response)
      await new Promise<void>((resolve) => {
        req.raw.on("close", resolve);
      });
    },
  );
}
