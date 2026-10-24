import "dotenv/config";
import { z } from "zod";

// `.env` lines like `WHATSAPP_API_URL=` arrive as "" — treat them as unset.
const emptyToUndef = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema);

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 chars"),
  DEMO_MODE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  DEMO_DATABASE_URL: emptyToUndef(z.string().url().optional()),
  DEMO_CORS_ORIGIN: emptyToUndef(z.string().optional()),
  DEMO_SEED_ADMIN_USERNAME: emptyToUndef(z.string().min(1).optional()),
  DEMO_SEED_ADMIN_PASSWORD: emptyToUndef(z.string().optional()),
  DEMO_SEED_ADMIN_FULLNAME: emptyToUndef(z.string().optional()),
  TENANCY_MODE: z.enum(["single", "multi"]).default("single"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  /**
   * WhatsApp integration (see lib/whatsapp.ts). Leave WHATSAPP_API_URL empty to disable sending
   * (whatsapp rows then simply stay `pending` in notification_queue).
   *  - Meta Cloud API  → WHATSAPP_API_URL=https://graph.facebook.com/<VERSION>/<PHONE_NUMBER_ID>/messages
   *  - Evolution API   → WHATSAPP_API_URL=https://<host>/message/sendText/<instance>
   *  - CallMeBot       → WHATSAPP_API_URL=https://api.callmebot.com/whatsapp.php
   * WHATSAPP_API_TOKEN is the access token / apikey for the chosen provider.
   * WHATSAPP_PROVIDER is optional (auto-detected from the URL). Meta also needs approved
   * WHATSAPP_ORDER_CREATED_TEMPLATE and WHATSAPP_ORDER_STATUS_TEMPLATE names.
   */
  WHATSAPP_API_URL: emptyToUndef(z.string().url().optional()),
  WHATSAPP_API_TOKEN: emptyToUndef(z.string().optional()),
  WHATSAPP_PROVIDER: emptyToUndef(z.enum(["meta", "evolution", "callmebot"]).optional()),
  WHATSAPP_ORDER_CREATED_TEMPLATE: emptyToUndef(z.string().regex(/^[a-z0-9_]+$/).optional()),
  WHATSAPP_ORDER_STATUS_TEMPLATE: emptyToUndef(z.string().regex(/^[a-z0-9_]+$/).optional()),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/).default("ar"),
  /** Prepended to local numbers that start with 0 (e.g. 01012345678 -> 201012345678). Egypt = 20. */
  WHATSAPP_DEFAULT_COUNTRY_CODE: z.string().regex(/^\d{1,4}$/).default("20"),
  WHATSAPP_CURRENCY_LABEL: z.string().default("ج.م"),
});

export const config = Env.parse(process.env);
if (config.DEMO_MODE && config.NODE_ENV === "production" && !config.DEMO_DATABASE_URL) {
  throw new Error("DEMO_MODE requires a dedicated DEMO_DATABASE_URL");
}
export const isProd = config.NODE_ENV === "production";

export const ACCESS_TTL = "15m";
export const REFRESH_TTL_DAYS = 30;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const REFRESH_COOKIE = "refresh_token";
