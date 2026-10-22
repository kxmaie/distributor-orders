import { describe, expect, it } from "vitest";
import { canTransition, CartPriceBody, StatusChangeBody } from "@do/shared";
import { formatOrderNo, mergeItems } from "../src/modules/orders/utils";

describe("order status machine", () => {
  it("allows the happy path and cancellation before delivery", () => {
    expect(canTransition("new", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "in_production")).toBe(true);
    expect(canTransition("in_production", "ready")).toBe(true);
    expect(canTransition("ready", "delivered")).toBe(true);
    for (const s of ["new", "confirmed", "in_production", "ready"] as const) expect(canTransition(s, "cancelled")).toBe(true);
  });
  it("blocks skipping, going back, and leaving terminal states", () => {
    expect(canTransition("new", "ready")).toBe(false);
    expect(canTransition("ready", "confirmed")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "new")).toBe(false);
  });
});

describe("order helpers", () => {
  it("formats order numbers", () => {
    expect(formatOrderNo(2026, 123)).toBe("ORD-2026-000123");
  });
  it("merges duplicate variants and sorts by id", () => {
    const r = mergeItems([{ variantId: 5n, qty: 2 }, { variantId: 2n, qty: 1 }, { variantId: 5n, qty: 3 }]);
    expect(r).toEqual([{ variantId: 2n, qty: 1 }, { variantId: 5n, qty: 5 }]);
  });
  it("rejects absurd merged quantities", () => {
    expect(() => mergeItems([{ variantId: 1n, qty: 60000 }, { variantId: 1n, qty: 60000 }])).toThrow();
  });
});

describe("order schemas", () => {
  it("validates cart bodies", () => {
    expect(CartPriceBody.parse({ items: [{ variantId: "7", qty: 2 }] }).items[0].variantId).toBe(7n);
    expect(() => CartPriceBody.parse({ items: [] })).toThrow();
    expect(() => CartPriceBody.parse({ items: [{ variantId: 1, qty: 0 }] })).toThrow();
  });
  it("validates status change", () => {
    expect(() => StatusChangeBody.parse({ status: "shipped" })).toThrow();
    expect(StatusChangeBody.parse({ status: "confirmed" }).status).toBe("confirmed");
  });
});
