import { describe, it, expect } from "vitest";
import { createRateLimiter } from "./rateLimit.js";

describe("createRateLimiter", () => {
  it("allows requests up to the limit, then rejects", () => {
    let now = 0;
    const limiter = createRateLimiter(3, 1000, () => now);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(false);
  });

  it("allows requests again once the window resets", () => {
    let now = 0;
    const limiter = createRateLimiter(1, 1000, () => now);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(false);
    now = 1001;
    expect(limiter.check("1.1.1.1")).toBe(true);
  });

  it("keeps separate limiters from sharing counts", () => {
    let now = 0;
    const a = createRateLimiter(1, 1000, () => now);
    const b = createRateLimiter(1, 1000, () => now);
    expect(a.check("1.1.1.1")).toBe(true);
    expect(a.check("1.1.1.1")).toBe(false);
    expect(b.check("1.1.1.1")).toBe(true);
  });
});
