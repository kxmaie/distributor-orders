/**
 * In-memory SSE broker.
 *
 * Clients connect via GET /api/v1/events.  Each connection is registered here
 * and removed when the socket closes.  The notification worker calls broadcast()
 * to push events to specific users (or broadcastAll() for everyone).
 */

import type { FastifyReply } from "fastify";

type Client = { id: string; reply: FastifyReply };

const clients = new Map<string, Client[]>(); // userId → connections

let _seq = 0;
const nextId = () => `c${++_seq}`;

function send(reply: FastifyReply, event: string, data: unknown) {
  try {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Socket may have closed between the check and the write — ignore
  }
}

export function addClient(userId: string, reply: FastifyReply): string {
  const id = nextId();
  const existing = clients.get(userId) ?? [];
  clients.set(userId, [...existing, { id, reply }]);
  return id;
}

export function removeClient(userId: string, clientId: string): void {
  const existing = clients.get(userId) ?? [];
  const updated = existing.filter((c) => c.id !== clientId);
  if (updated.length === 0) {
    clients.delete(userId);
  } else {
    clients.set(userId, updated);
  }
}

/** Send an event to every connection belonging to a single user. */
export function broadcast(userId: string, event: string, data: unknown): void {
  const conns = clients.get(userId);
  if (!conns) return;
  for (const c of conns) send(c.reply, event, data);
}

/** Send an event to ALL connected clients (e.g. admin-wide broadcasts). */
export function broadcastAll(event: string, data: unknown): void {
  for (const conns of clients.values()) {
    for (const c of conns) send(c.reply, event, data);
  }
}

/** How many unique users are currently connected (for diagnostics). */
export function connectedUserCount(): number {
  return clients.size;
}
