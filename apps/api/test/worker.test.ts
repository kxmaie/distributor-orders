import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rows: [] as any[],
  updates: [] as { where: any; data: any }[],
  claimCount: 1,
  configured: true,
  send: vi.fn(),
  broadcast: vi.fn(),
  lastFind: undefined as any,
}));

vi.mock("../src/lib/db", () => ({
  prisma: {
    notificationQueue: {
      findMany: vi.fn(async (args: any) => {
        m.lastFind = args;
        return m.rows;
      }),
      updateMany: vi.fn(async (a: any) => { m.updates.push(a); return { count: a.data.attempts !== undefined && !a.data.status ? m.claimCount : 1 }; }),
      update: vi.fn(async (a: any) => { m.updates.push(a); return {}; }),
    },
  },
}));
vi.mock("../src/lib/sse", () => ({ broadcast: m.broadcast }));
vi.mock("../src/lib/whatsapp", () => ({
  isWhatsAppConfigured: () => m.configured,
  sendWhatsApp: m.send,
  PermanentError: class PermanentError extends Error {},
}));

import { processOneBatch } from "../src/lib/worker";
import { PermanentError } from "../src/lib/whatsapp";

const row = (o: any = {}) => ({
  id: 1n, channel: "whatsapp", recipient: "01012345678", payload: '{"type":"order_created"}',
  status: "pending", attempts: 0, nextAttemptAt: new Date(), ...o,
});
const finalUpdate = () => m.updates[m.updates.length - 1];

beforeEach(() => {
  m.rows = []; m.updates = []; m.claimCount = 1; m.configured = true;
  m.send.mockReset(); m.broadcast.mockReset();
});

describe("notification worker", () => {
  it("marks a whatsapp row `sent` only after the provider call resolves", async () => {
    m.rows = [row()];
    m.send.mockResolvedValue(undefined);
    await processOneBatch();
    expect(m.send).toHaveBeenCalledWith("01012345678", '{"type":"order_created"}');
    expect(finalUpdate().data).toEqual({ status: "sent" });
  });

  it("provider failure → back to `pending` with a later nextAttemptAt (retry)", async () => {
    m.rows = [row()];
    m.send.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await processOneBatch();
    const d = finalUpdate().data;
    expect(d.status).toBe("pending");
    expect(d.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 30_000);
  });

  it("last attempt → terminal `failed`", async () => {
    m.rows = [row({ attempts: 2 })];
    m.send.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await processOneBatch();
    expect(finalUpdate().data.status).toBe("failed");
  });

  it("permanent error (bad phone) → `failed` immediately", async () => {
    m.rows = [row()];
    m.send.mockRejectedValue(new PermanentError("Invalid phone"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await processOneBatch();
    expect(finalUpdate().data.status).toBe("failed");
  });

  it("in_app rows are pushed over SSE and marked sent", async () => {
    m.rows = [row({ channel: "in_app", recipient: "7", payload: '{"type":"order_status","orderNo":"X"}' })];
    await processOneBatch();
    expect(m.broadcast).toHaveBeenCalledWith("7", "order_status", { type: "order_status", orderNo: "X" });
    expect(finalUpdate().data).toEqual({ status: "sent" });
  });

  it("skips a row another worker already claimed", async () => {
    m.rows = [row()];
    m.claimCount = 0;
    await processOneBatch();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("when WhatsApp is not configured, only in_app rows are queried (whatsapp stays pending)", async () => {
    m.configured = false;
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await processOneBatch();
    expect(m.lastFind.where.channel).toBe("in_app");
  });
});
