import { describe, expect, it } from "vitest";
import { DiscountCreate, Money, PasswordResolveBody, Pct, SignedMoney, StockAdjustBody, UserCreate, VariantCreate } from "@do/shared";
import { slugify } from "../src/lib/slug";

describe("slugify", () => {
  it("makes ascii slugs and returns empty for Arabic-only names", () => {
    expect(slugify("UPVC Windows 2026")).toBe("upvc-windows-2026");
    expect(slugify("شبابيك")).toBe("");
  });
});

describe("money", () => {
  it("accepts up to 2 decimals", () => {
    expect(Money.parse(10)).toBe("10");
    expect(Money.parse("1250.50")).toBe("1250.50");
    expect(() => Money.parse("1.234")).toThrow();
    expect(() => Money.parse("-1")).toThrow();
    expect(SignedMoney.parse("-25.5")).toBe("-25.5");
  });
});

describe("stock adjust schema", () => {
  it("rejects zero delta and parses bigint ids", () => {
    expect(() => StockAdjustBody.parse({ variantId: "1", warehouseId: 1, delta: 0 })).toThrow();
    expect(StockAdjustBody.parse({ variantId: "12", warehouseId: 1, delta: 5 }).variantId).toBe(12n);
  });
  it("variant create defaults priceDelta", () => {
    expect(VariantCreate.parse({ productId: 3, sku: "WIN-120x150-W", label: "120x150" }).priceDelta).toBe("0");
  });
});

describe("admin schemas", () => {
  it("accepts percent 0–100", () => {
    expect(Pct.parse("12.5")).toBe("12.5");
    expect(() => Pct.parse("100.1")).toThrow();
  });
  it("user create requires a long password", () => {
    expect(() => UserCreate.parse({ username: "dist1", password: "short", fullName: "أ" })).toThrow();
    expect(UserCreate.parse({ username: "dist1", password: "a".repeat(12), fullName: "موزع" }).role).toBe("distributor");
  });
  it("password resolve requires a new password", () => {
    expect(() => PasswordResolveBody.parse({ status: "resolved" })).toThrow();
    expect(PasswordResolveBody.parse({ status: "rejected" }).status).toBe("rejected");
  });
  it("discount create allows a global percent", () => {
    expect(DiscountCreate.parse({ pct: 10 }).pct).toBe("10");
  });
});
