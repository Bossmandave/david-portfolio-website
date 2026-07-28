import { beforeEach, describe, expect, it } from "vitest";

import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(resetRateLimits);

  it("allows up to capacity, then refuses", () => {
    const options = { capacity: 3, refillSeconds: 600, now: 0 };

    expect(rateLimit("a", options).ok).toBe(true);
    expect(rateLimit("a", options).ok).toBe(true);
    expect(rateLimit("a", options).ok).toBe(true);
    expect(rateLimit("a", options).ok).toBe(false);
  });

  it("tells the caller how long to wait", () => {
    const options = { capacity: 1, refillSeconds: 600, now: 0 };
    rateLimit("b", options);

    const refused = rateLimit("b", options);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfter).toBeGreaterThan(0);
    expect(refused.retryAfter).toBeLessThanOrEqual(600);
  });

  it("refills over time rather than resetting in a lump", () => {
    const options = { capacity: 2, refillSeconds: 600 };

    rateLimit("c", { ...options, now: 0 });
    rateLimit("c", { ...options, now: 0 });
    expect(rateLimit("c", { ...options, now: 0 }).ok).toBe(false);

    // One token every 300s at capacity 2 over 600s.
    expect(rateLimit("c", { ...options, now: 300_000 }).ok).toBe(true);
    expect(rateLimit("c", { ...options, now: 300_000 }).ok).toBe(false);
  });

  it("keeps callers independent", () => {
    const options = { capacity: 1, refillSeconds: 600, now: 0 };

    expect(rateLimit("one", options).ok).toBe(true);
    expect(rateLimit("one", options).ok).toBe(false);
    // A different origin must be unaffected by the first one's spending.
    expect(rateLimit("two", options).ok).toBe(true);
  });
});
