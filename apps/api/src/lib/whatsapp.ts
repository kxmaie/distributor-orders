/**
 * WhatsApp delivery — provider-agnostic, no DB access (easy to unit-test).
 *
 * Providers (pick with WHATSAPP_PROVIDER, or leave it out and it is auto-detected from WHATSAPP_API_URL):
 *
 *  meta       WHATSAPP_API_URL=https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages
 *             WHATSAPP_API_TOKEN=<permanent access token>            → Authorization: Bearer
 *  evolution  WHATSAPP_API_URL=https://<host>/message/sendText/<instance>
 *             WHATSAPP_API_TOKEN=<apikey>                            → header `apikey`
 *  callmebot  WHATSAPP_API_URL=https://api.callmebot.com/whatsapp.php (testing only)
 *             WHATSAPP_API_TOKEN=<apikey you got from the CallMeBot bot>
 *
 * Every sender THROWS on failure and resolves only when the provider really accepted the message,
 * so the worker can mark the queue row `sent` based on the actual response.
 */
import { config } from "../config";

export type WaProvider = "meta" | "evolution" | "callmebot";

export interface WaPayload {
  type: "order_created" | "order_status";
  orderNo?: string;
  orderId?: string | number;
  total?: string;
  distributor?: string;
  from?: string;
  to?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;

const STATUS_AR: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  ready: "جاهز للاستلام",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

export function isWhatsAppConfigured(): boolean {
  if (!config.WHATSAPP_API_URL || !config.WHATSAPP_API_TOKEN) return false;
  const provider = detectProvider(config.WHATSAPP_API_URL, config.WHATSAPP_PROVIDER);
  return provider !== "meta" || Boolean(config.WHATSAPP_ORDER_CREATED_TEMPLATE && config.WHATSAPP_ORDER_STATUS_TEMPLATE);
}

export function detectProvider(url: string, explicit?: WaProvider): WaProvider {
  if (explicit) return explicit;
  if (url.includes("graph.facebook.com")) return "meta";
  if (url.includes("callmebot.com")) return "callmebot";
  return "evolution";
}

/**
 * Normalise a phone number to digits-only international format (what Meta / Evolution expect).
 *   "+20 101 234 5678" -> "201012345678"
 *   "01012345678"      -> "201012345678"   (local number, default country code is prepended)
 *   "0020101..."       -> "20101..."
 * Returns null if the result does not look like a phone number.
 */
export function normalizePhone(raw: string, defaultCountryCode = config.WHATSAPP_DEFAULT_COUNTRY_CODE): string | null {
  let d = raw.replace(/[\s\-().]/g, "");
  const hadPlus = d.startsWith("+");
  d = d.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (!hadPlus && d.startsWith("0")) d = defaultCountryCode + d.slice(1);
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export function buildMessage(p: WaPayload, currency = config.WHATSAPP_CURRENCY_LABEL): string {
  if (p.type === "order_created") {
    return (
      `🛒 طلب جديد!\n` +
      `رقم الطلب: ${p.orderNo ?? ""}\n` +
      `الموزع: ${p.distributor ?? ""}\n` +
      `الإجمالي: ${p.total ?? ""} ${currency}`
    );
  }
  const toLabel = STATUS_AR[p.to ?? ""] ?? p.to ?? "";
  return `📦 تحديث طلب ${p.orderNo ?? ""}\nالحالة الجديدة: ${toLabel}`;
}

async function http(url: string, init: RequestInit, label: string): Promise<{ status: number; body: string }> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (e) {
    throw new Error(`${label} network error: ${e instanceof Error ? e.message : String(e)}`);
  }
  const body = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}: ${body.slice(0, 300)}`);
  return { status: res.status, body };
}

async function sendViaMeta(to: string, payload: WaPayload, token: string, url: string) {
  const isCreated = payload.type === "order_created";
  const templateName = isCreated ? config.WHATSAPP_ORDER_CREATED_TEMPLATE : config.WHATSAPP_ORDER_STATUS_TEMPLATE;
  if (!templateName) throw new PermanentError(`Missing approved WhatsApp template for ${payload.type}`);
  const values = isCreated
    ? [payload.orderNo ?? "", payload.distributor ?? "", payload.total ?? "", config.WHATSAPP_CURRENCY_LABEL]
    : [payload.orderNo ?? "", STATUS_AR[payload.to ?? ""] ?? payload.to ?? ""];
  const { body } = await http(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: "whatsapp", to, type: "template",
        template: {
          name: templateName,
          language: { code: config.WHATSAPP_TEMPLATE_LANGUAGE },
          components: [{ type: "body", parameters: values.map((text) => ({ type: "text", text })) }],
        },
      }),
    },
    "Meta",
  );
  // Success = Meta returned a message id. Template messages are approved and can be sent outside
  // the 24-hour customer-service window.
  let id: string | undefined;
  try { id = (JSON.parse(body) as { messages?: { id?: string }[] }).messages?.[0]?.id; } catch { /* not json */ }
  if (!id) throw new Error(`Meta: no message id in response: ${body.slice(0, 300)}`);
}

async function sendViaEvolution(to: string, text: string, token: string, url: string) {
  await http(
    url,
    { method: "POST", headers: { "Content-Type": "application/json", apikey: token }, body: JSON.stringify({ number: to, text }) },
    "Evolution",
  );
}

async function sendViaCallMeBot(to: string, text: string, token: string, baseUrl: string) {
  const u = new URL(baseUrl);
  u.searchParams.set("phone", `+${to}`);
  u.searchParams.set("text", text);
  u.searchParams.set("apikey", token);
  const { body } = await http(u.toString(), { method: "GET" }, "CallMeBot");
  // CallMeBot answers HTTP 200 with an HTML page even for failures — inspect the text.
  if (/error|invalid|not\s+(registered|activated)|apikey is/i.test(body)) {
    throw new Error(`CallMeBot: ${body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}`);
  }
}

/** Send one WhatsApp text. Throws on any failure (including "not configured" and "bad phone"). */
export async function sendWhatsApp(recipientRaw: string, payloadJson: string): Promise<void> {
  const url = config.WHATSAPP_API_URL;
  if (!isWhatsAppConfigured()) throw new PermanentError("WhatsApp credentials and approved message templates are not configured");
  if (!url) throw new PermanentError("WhatsApp API URL is missing");

  const to = normalizePhone(recipientRaw);
  if (!to) throw new PermanentError(`Invalid phone number: "${recipientRaw}"`);

  let payload: WaPayload;
  try { payload = JSON.parse(payloadJson) as WaPayload; } catch { throw new PermanentError("Unparseable notification payload"); }
  const text = buildMessage(payload);
  const token = config.WHATSAPP_API_TOKEN ?? "";

  switch (detectProvider(url, config.WHATSAPP_PROVIDER)) {
    case "meta": return sendViaMeta(to, payload, token, url);
    case "callmebot": return sendViaCallMeBot(to, text, token, url);
    default: return sendViaEvolution(to, text, token, url);
  }
}

/** Errors that retrying cannot fix (bad phone, bad payload) — the worker fails the row immediately. */
export class PermanentError extends Error {}
