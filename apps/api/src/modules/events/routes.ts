/**
 * GET /api/v1/events — Server-Sent Events endpoint.
 *
 * Authentication: JWT sent either as:
 *   - Authorization: Bearer <token>   (standard header)
 *   - ?token=<token>                  (query param, needed when EventSource
 *                                      doesn't support custom headers)
 *
 * The connection stays open indefinitely.  A ping is sent every 30 s to
 * keep proxies/load-balancers from closing the socket.
 */

import type { FastifyInstance } from "fastify";
import { addClient, removeClient } from "../../lib/sse";

const PING_INTERVAL = 30_000;

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

      const userId = req.user.sub; // string id from JWT payload

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

      // Clean up on disconnect
      req.raw.on("close", () => {
        clearInterval(ping);
        removeClient(userId, clientId);
      });

      // Keep the handler promise pending (Fastify must not close the response)
      await new Promise<void>((resolve) => {
        req.raw.on("close", resolve);
      });
    },
  );
}
