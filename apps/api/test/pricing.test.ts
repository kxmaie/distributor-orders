import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calcLine } from "../src/modules/orders/pricing";

const D = (v: string | number) => new Prisma.Decimal(v);

describe("calcLine", () => {
  it("applies the discount per line with half-up rounding", () => {
    const r = calcLine(D("1600"), D("10"), 3); // 4800 - 480
    expect(r.gross.toFixed(2)).toBe("4800.00");
    expect(r.discount.toFixed(2)).toBe("480.00");
    expect(r.lineTotal.toFixed(2)).toBe("4320.00");
  });
  it("rounds odd percentages to 2 decimals", () => {
    const r = calcLine(D("99.99"), D("12.5"), 1); // 12.49875 -> 12.50
    expect(r.discount.toFixed(2)).toBe("12.50");
    expect(r.lineTotal.toFixed(2)).toBe("87.49");
  });
  it("0% discount leaves the price unchanged", () => {
    expect(calcLine(D("250.50"), D(0), 2).lineTotal.toFixed(2)).toBe("501.00");
  });
});
