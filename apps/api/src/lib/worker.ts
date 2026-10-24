/**
 * Background notification worker.
 *
 * Drains `notification_queue`:
 *   channel `in_app`   → pushed over SSE (lib/sse.ts) to the recipient's open connections
 *   channel `whatsapp` → sent through the provider configured in lib/whatsapp.ts
 *
 * Row lifecycle:  pending ──ok──▶ sent
 *                 pending ──error──▶ pending (retry later, exponential back-off)
 *                 pending ──error on last attempt / permanent error──▶ failed (terminal)
 * A row is only ever marked `sent` after the provider confirmed the send (sendWhatsApp resolved).
 *
 * Speed: the loop polls every POLL_INTERVAL, but `wakeWorker()` (called right after an order
 * transaction commits) runs a batch almost immediately, so toasts / the bell don't wait for the poll.
 */
import { prisma } from "./db";
import { broadcast, tenantUserKey } from "./sse";
import { send as sendQueueMessage } from "@vercel/queue";
import { config } from "../config";
import { currentTenant, runWithTenant } from "./tenant-context";
import { resolveTenant } from "./tenant-registry";
import { waitUntil } from "@vercel/functions";
import { isWhatsAppConfigured, PermanentError, sendWhatsApp } from "./whatsapp";

const POLL_INTERVAL = 5_000;
const WAKE_DELAY = 50;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 30_000;        // after attempt n → wait 2^n × 30 s (60 s, 120 s, …)
const LEASE_MS = 2 * 60_000;         // a claimed row isn't re-picked for this long (crash safety)
const STALE_WHATSAPP_MS = 24 * 3600_000; // never send "new order" messages older than a day
const WHATSAPP_TOPIC = "whatsapp-notifications";

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let running = false;
let wakeRequested = false;
let warnedUnconfigured = false;

function deliverInApp(recipient: string, payloadJson: string): void {
  let data: unknown;
  try { data = JSON.parse(payloadJson); } catch { data = payloadJson; }
  broadcast(tenantUserKey(recipient), (data as { type?: string })?.type ?? "notification", data);
}

export async function processOneBatch(): Promise<void> {
  const now = new Date();
  const waOn = isWhatsAppConfigured();
  if (!waOn && !warnedUnconfigured) {
    warnedUnconfigured = true;
    console.warn("[worker] WHATSAPP_API_URL is not set — whatsapp notifications stay `pending` until it is configured");
  }

  const rows = await prisma.notificationQueue.findMany({
    where: {
      status: { in: ["pending", "failed"] },
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
      // Not configured → leave whatsapp rows untouched (don't pretend they were sent).
      ...(waOn ? {} : { channel: "in_app" }),
    },
    take: 50,
    orderBy: { nextAttemptAt: "asc" },
  });

  for (const row of rows) {
    await processRow(row, false);
  }
}

class RetryAfterError extends Error {
  constructor(message: string, readonly afterSeconds: number) { super(message); }
}

async function processRow(row: Awaited<ReturnType<typeof prisma.notificationQueue.findFirstOrThrow>>, retryOnTransient: boolean) {
  const now = new Date();
  const attempt = row.attempts + 1;
  if (row.channel === "whatsapp" && row.attempts === 0 && now.getTime() - row.nextAttemptAt.getTime() > STALE_WHATSAPP_MS) {
    await prisma.notificationQueue.updateMany({ where: { id: row.id, status: row.status, attempts: row.attempts }, data: { status: "failed", attempts: MAX_ATTEMPTS } });
    console.warn(`[worker] notification id=${row.id} expired unsent (older than 24h)`);
    return;
  }

  const claimed = await prisma.notificationQueue.updateMany({
    where: { id: row.id, status: row.status, attempts: row.attempts, nextAttemptAt: { lte: now } },
    data: { attempts: attempt, nextAttemptAt: new Date(Date.now() + LEASE_MS) },
  });
  if (claimed.count !== 1) return;

  try {
    if (row.channel === "whatsapp") await sendWhatsApp(row.recipient, row.payload);
    else if (row.channel === "in_app") deliverInApp(row.recipient, row.payload);
    else throw new PermanentError(`Unknown channel "${row.channel}"`);
    await prisma.notificationQueue.update({ where: { id: row.id }, data: { status: "sent" } });
  } catch (err) {
    const permanent = err instanceof PermanentError;
    const terminal = permanent || attempt >= MAX_ATTEMPTS;
    const afterSeconds = Math.ceil((Math.pow(2, attempt) * BASE_DELAY_MS) / 1000);
    await prisma.notificationQueue.update({
      where: { id: row.id },
      data: terminal
        ? { status: "failed", attempts: MAX_ATTEMPTS }
        : { status: "pending", nextAttemptAt: new Date(Date.now() + afterSeconds * 1000) },
    });
    console.error(`[worker] notification id=${row.id} channel=${row.channel} attempt=${attempt}/${MAX_ATTEMPTS}${terminal ? " (gave up)" : ""}:`, err instanceof Error ? err.message : err);
    if (retryOnTransient && !terminal) throw new RetryAfterError("WhatsApp provider failed; retrying", afterSeconds);
  }
}

/** Called only by Vercel's private queue consumer. The queue retries transient provider failures. */
export async function processWhatsAppNotification(id: string): Promise<void> {
  if (!/^\d+$/.test(id)) throw new PermanentError("Invalid notification id");
  const row = await prisma.notificationQueue.findUnique({ where: { id: BigInt(id) } });
  if (!row || row.channel !== "whatsapp" || row.status === "sent" || (row.status === "failed" && row.attempts >= MAX_ATTEMPTS)) return;
  if (row.nextAttemptAt > new Date()) throw new RetryAfterError("Notification is waiting for its retry window", Math.max(1, Math.ceil((row.nextAttemptAt.getTime() - Date.now()) / 1000)));
  await processRow(row, true);
}

/** Resolve the database before a queue delivery; each tenant may reuse the same local notification id. */
export async function processWhatsAppNotificationForTenant(id: string, tenantSlug?: string): Promise<void> {
  if (config.TENANCY_MODE !== "multi") return processWhatsAppNotification(id);
  if (!tenantSlug || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenantSlug)) throw new PermanentError("Tenant slug is required for a multi-tenant queue message");
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) throw new PermanentError("Tenant is missing or suspended");
  try { await runWithTenant(tenant, () => processWhatsAppNotification(id)); }
  finally { tenant.release(); }
}

/** Best-effort SSE delivery runs inside the current request's tenant context. */
async function processInAppBatch(): Promise<void> {
  const rows = await prisma.notificationQueue.findMany({
    where: { channel: "in_app", status: { in: ["pending", "failed"] }, nextAttemptAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    take: 50,
    orderBy: { nextAttemptAt: "asc" },
  });
  for (const row of rows) await processRow(row, false);
}
/** Publish the durable database outbox to Vercel Queues after the order transaction commits. */
async function publishWhatsAppOutbox(): Promise<void> {
  if (!isWhatsAppConfigured()) return;
  const cutoff = new Date(Date.now() - STALE_WHATSAPP_MS);
  await prisma.notificationQueue.updateMany({
    where: { channel: "whatsapp", status: "pending", attempts: 0, dispatchedAt: null, nextAttemptAt: { lt: cutoff } },
    data: { status: "failed", attempts: MAX_ATTEMPTS },
  });
  const rows = await prisma.notificationQueue.findMany({
    where: { channel: "whatsapp", status: "pending", attempts: { lt: MAX_ATTEMPTS }, nextAttemptAt: { lte: new Date() }, OR: [{ dispatchedAt: null, nextAttemptAt: { gte: cutoff } }, { dispatchedAt: { lt: cutoff } }] },
    orderBy: { nextAttemptAt: "asc" }, take: 50,
  });
  for (const row of rows) {
    try {
      const tenant = currentTenant();
      if (config.TENANCY_MODE === "multi" && !tenant) {
        console.error(`[worker] refusing to publish tenantless WhatsApp notification id=${row.id}`);
        continue;
      }
      await sendQueueMessage(WHATSAPP_TOPIC, { notificationId: row.id.toString(), ...(tenant ? { tenantSlug: tenant.slug } : {}) }, {
        idempotencyKey: `whatsapp-notification-${tenant?.id ?? "single"}-${row.id}`,
        retentionSeconds: 86_400,
      });
      await prisma.notificationQueue.updateMany({
        where: { id: row.id, status: "pending", dispatchedAt: row.dispatchedAt },
        data: { dispatchedAt: new Date() },
      });
    } catch (err) {
      console.error(`[worker] could not publish WhatsApp notification id=${row.id}:`, err instanceof Error ? err.message : err);
    }
  }
}

function schedule(delay: number) {
  if (!started) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(tick, delay);
}

async function tick() {
  if (running) { wakeRequested = true; return; }
  running = true;
  wakeRequested = false;
  try {
    await processOneBatch();
  } catch (err) {
    console.error("[worker] batch error:", err);
  } finally {
    running = false;
    schedule(wakeRequested ? WAKE_DELAY : POLL_INTERVAL);
  }
}

/** Process the queue now-ish instead of waiting for the next poll. Safe to call from anywhere, any time. */
export function wakeWorker(): void {
  if (process.env.VERCEL) {
    const tenant = currentTenant();
    if (config.TENANCY_MODE === "multi") {
      if (!tenant) {
        console.error("[worker] refusing to wake a tenantless multi-tenant worker");
        return;
      }
      waitUntil((async () => {
        const backgroundTenant = await resolveTenant(tenant.slug);
        if (!backgroundTenant) return;
        try {
          await runWithTenant(backgroundTenant, async () => {
            await processInAppBatch();
            await publishWhatsAppOutbox();
          });
        } finally { backgroundTenant.release(); }
      })().catch((err) => console.error("[worker] tenant notification work failed:", err)));
    } else {
      waitUntil(Promise.all([processInAppBatch(), publishWhatsAppOutbox()]).catch((err) => console.error("[worker] notification work failed:", err)));
    }
    return;
  }
  if (config.TENANCY_MODE === "multi") {
    const tenant = currentTenant();
    if (!tenant) return;
    void (async () => {
      const backgroundTenant = await resolveTenant(tenant.slug);
      if (!backgroundTenant) return;
      try { await runWithTenant(backgroundTenant, () => processOneBatch()); }
      finally { backgroundTenant.release(); }
    })().catch((err) => console.error("[worker] tenant notification work failed:", err));
    return;
  }
  if (!started) return;
  if (running) { wakeRequested = true; return; }
  schedule(WAKE_DELAY);
}

export function startWorker(): void {
  if (started) return;
  started = true;
  schedule(POLL_INTERVAL);
  console.log("[worker] notification worker started (poll every", POLL_INTERVAL / 1000, "s)");
}

export function stopWorker(): void {
  started = false;
  if (timer) { clearTimeout(timer); timer = null; }
}
