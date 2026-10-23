import { z } from "zod";

const bigId = z.union([z.string().regex(/^\d+$/), z.number().int().positive()]).transform((v) => BigInt(v));
const Money = z.union([z.number(), z.string()]).transform(String).refine((v) => /^\d{1,10}(\.\d{1,2})?$/.test(v) && Number(v) > 0, "Invalid amount");

export const CreateDeliveryBody = z.object({
  trackingNumber: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
  items: z.array(z.object({ orderItemId: bigId, qty: z.number().int().min(1).max(1_000_000) })).min(1).max(100),
});

export const CreatePaymentBody = z.object({
  amount: Money,
  method: z.enum(["cash", "bank_transfer", "check", "other"]),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
});

export const AccountQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
