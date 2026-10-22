import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cfg = vi.hoisted(() => ({
  WHATSAPP_API_URL: undefined as string | undefined,
  WHATSAPP_API_TOKEN: "tok",
  WHATSAPP_PROVIDER: undefined as "meta" | "evolution" | "callmebot" | undefined,
  WHATSAPP_DEFAULT_COUNTRY_CODE: "20",
  WHATSAPP_CURRENCY_LABEL: "ج.م",
}));
vi.mock("../src/config", () => ({ config: cfg }));

import { buildMessage, detectProvider, normalizePhone, PermanentError, sendWhatsApp } from "../src/lib/whatsapp";

const created = JSON.stringify({ type: "order_created", orderNo: "ORD-2026-000001", total: "150.00", distributor: "أحمد" });
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  cfg.WHATSAPP_API_URL = undefined;
  cfg.WHATSAPP_PROVIDER = undefined;
});
afterEach(() => vi.unstubAllGlobals());

describe("normalizePhone", () => {
  it.each([
    ["+20 101 234 5678", "201012345678"],
    ["01012345678", "201012345678"],
    ["0020 101 234 5678", "201012345678"],
    ["(966) 50-123-4567", "966501234567"],
  ])("%s -> %s", (raw, out) => expect(normalizePhone(raw)).toBe(out));
  it("rejects garbage", () => {
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("buildMessage / detectProvider", () => {
  it("builds Arabic texts", () => {
    expect(buildMessage(JSON.parse(created))).toContain("ORD-2026-000001");
    expect(buildMessage(JSON.parse(created))).toContain("150.00 ج.م");
    expect(buildMessage({ type: "order_status", orderNo: "X", to: "ready" })).toContain("جاهز للاستلام");
  });
  it("auto-detects the provider from the URL", () => {
    expect(detectProvider("https://graph.facebook.com/v21.0/1/messages")).toBe("meta");
    expect(detectProvider("https://api.callmebot.com/whatsapp.php")).toBe("callmebot");
    expect(detectProvider("https://evo.example.com/message/sendText/inst")).toBe("evolution");
    expect(detectProvider("https://x", "meta")).toBe("meta");
  });
});

describe("sendWhatsApp", () => {
  it("throws when not configured (so the row is never marked sent)", async () => {
    await expect(sendWhatsApp("01012345678", created)).rejects.toThrow(/not configured/);
  });

  it("permanent error on invalid phone, no HTTP call", async () => {
    cfg.WHATSAPP_API_URL = "https://evo.example.com/message/sendText/i";
    await expect(sendWhatsApp("nope", created)).rejects.toBeInstanceOf(PermanentError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Meta: succeeds only when a message id is returned", async () => {
    cfg.WHATSAPP_API_URL = "https://graph.facebook.com/v21.0/123/messages";
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }));
    await expect(sendWhatsApp("01012345678", created)).resolves.toBeUndefined();
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).to).toBe("201012345678");
    expect(init.headers.Authorization).toBe("Bearer tok");

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await expect(sendWhatsApp("01012345678", created)).rejects.toThrow(/no message id/);

    fetchMock.mockResolvedValueOnce(new Response('{"error":{"message":"bad token"}}', { status: 401 }));
    await expect(sendWhatsApp("01012345678", created)).rejects.toThrow(/HTTP 401/);
  });

  it("Evolution: posts number + text with apikey header", async () => {
    cfg.WHATSAPP_API_URL = "https://evo.example.com/message/sendText/inst";
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 201 }));
    await sendWhatsApp("+201012345678", created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://evo.example.com/message/sendText/inst");
    expect(init.headers.apikey).toBe("tok");
    expect(JSON.parse(init.body).number).toBe("201012345678");
  });

  it("CallMeBot: HTTP 200 with an error body is a failure", async () => {
    cfg.WHATSAPP_API_URL = "https://api.callmebot.com/whatsapp.php";
    fetchMock.mockResolvedValueOnce(new Response("<p>Message queued. You will receive it in a few seconds.</p>", { status: 200 }));
    await expect(sendWhatsApp("01012345678", created)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toContain("phone=%2B201012345678");

    fetchMock.mockResolvedValueOnce(new Response("<p>ERROR: apikey is invalid</p>", { status: 200 }));
    await expect(sendWhatsApp("01012345678", created)).rejects.toThrow(/CallMeBot/);
  });

  it("network failure rejects (retryable)", async () => {
    cfg.WHATSAPP_API_URL = "https://evo.example.com/message/sendText/inst";
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    await expect(sendWhatsApp("01012345678", created)).rejects.toThrow(/network error/);
  });
});
