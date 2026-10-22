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
import { broadcast } from "./sse";
import { isWhatsAppConfigured, PermanentError, sendWhatsApp } from "./whatsapp";

const POLL_INTERVAL = 5_000;
const WAKE_DELAY = 50;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 30_000;        // after attempt n → wait 2^n × 30 s (60 s, 120 s, …)
const LEASE_MS = 2 * 60_000;         // a claimed row isn't re-picked for this long (crash safety)
const STALE_WHATSAPP_MS = 24 * 3600_000; // never send "new order" messages older than a day

let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let running = false;
let wakeRequested = false;
let warnedUnconfigured = false;

function deliverInApp(recipient: string, payloadJson: string): void {
  let data: unknown;
  try { data = JSON.parse(payloadJson); } catch { data = payloadJson; }
  broadcast(recipient, (data as { type?: string })?.type ?? "notification", data);
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
    const attempt = row.attempts + 1;

    // Drop stale WhatsApp messages (e.g. backlog that piled up before the integration was configured).
    if (row.channel === "whatsapp" && row.attempts === 0 && now.getTime() - row.nextAttemptAt.getTime() > STALE_WHATSAPP_MS) {
      await prisma.notificationQueue.updateMany({
        where: { id: row.id, status: row.status, attempts: row.attempts },
        data: { status: "failed", attempts: MAX_ATTEMPTS },
      });
      console.warn(`[worker] notification id=${row.id} expired unsent (older than 24h)`);
      continue;
    }

    // Claim the row (compare-and-set) so two workers / overlapping ticks can't send it twice.
    const claimed = await prisma.notificationQueue.updateMany({
      where: { id: row.id, status: row.status, attempts: row.attempts },
      data: { attempts: attempt, nextAttemptAt: new Date(Date.now() + LEASE_MS) },
    });
    if (claimed.count !== 1) continue;

    try {
      if (row.channel === "whatsapp") await sendWhatsApp(row.recipient, row.payload);
      else if (row.channel === "in_app") deliverInApp(row.recipient, row.payload);
      else throw new PermanentError(`Unknown channel "${row.channel}"`);

      await prisma.notificationQueue.update({ where: { id: row.id }, data: { status: "sent" } });
    } catch (err) {
      const permanent = err instanceof PermanentError;
      const terminal = permanent || attempt >= MAX_ATTEMPTS;
      await prisma.notificationQueue.update({
        where: { id: row.id },
        data: terminal
          ? { status: "failed", attempts: MAX_ATTEMPTS }
          : { status: "pending", nextAttemptAt: new Date(Date.now() + Math.pow(2, attempt) * BASE_DELAY_MS) },
      });
      console.error(
        `[worker] notification id=${row.id} channel=${row.channel} attempt=${attempt}/${MAX_ATTEMPTS}${terminal ? " (gave up)" : ""}:`,
        err instanceof Error ? err.message : err,
      );
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
