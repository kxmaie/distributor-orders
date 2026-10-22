import { describe, expect, it } from "vitest";
import { newRefreshToken, sha256 } from "../src/lib/tokens";

describe("tokens", () => {
  it("generates unique, long refresh tokens", () => {
    const a = newRefreshToken();
    expect(a).not.toBe(newRefreshToken());
    expect(a.length).toBeGreaterThanOrEqual(64);
  });
  it("hashes deterministically to 64 hex chars", () => {
    expect(sha256("x")).toBe(sha256("x"));
    expect(sha256("x")).toMatch(/^[a-f0-9]{64}$/);
  });
});
