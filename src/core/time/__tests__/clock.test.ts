import { describe, expect, it } from "vitest";

import { FixedClock } from "@/core/time/clock";

describe("FixedClock", () => {
  it("emits nothing on the first sample, having no delta yet", () => {
    const clock = new FixedClock(240);
    expect(clock.advance(1000)).toBe(0);
  });

  it("delivers a whole number of fixed steps per frame", () => {
    const clock = new FixedClock(240);
    clock.advance(0);

    // A 60 Hz frame is exactly four 240 Hz steps.
    expect(clock.advance(16.666)).toBe(3);
    expect(clock.advance(33.333)).toBe(4);
  });

  it("carries the remainder forward rather than discarding it", () => {
    const clock = new FixedClock(100); // dt = 10ms
    clock.advance(0);

    expect(clock.advance(15)).toBe(1);
    expect(clock.alpha).toBeCloseTo(0.5, 3);
    // The leftover 5ms plus another 6ms clears a second step.
    expect(clock.advance(21)).toBe(1);
  });

  it("caps catch-up work after a stall instead of spiralling", () => {
    const clock = new FixedClock(240, 8);
    clock.advance(0);

    // Ten seconds backgrounded would otherwise demand 2400 substeps.
    expect(clock.advance(10_000)).toBe(8);
  });

  it("ignores backwards or non-finite deltas", () => {
    const clock = new FixedClock(240);
    clock.advance(1000);

    expect(clock.advance(900)).toBe(0);
    expect(clock.advance(Number.NaN)).toBe(0);
  });
});
