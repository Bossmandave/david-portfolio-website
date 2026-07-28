import { describe, expect, it } from "vitest";

import { analyseLoop } from "@/core/control/analysis";
import { ringingFromDamping } from "@/engine/gl/ambient-state";
import { DEFAULT_SETTINGS } from "@/modules/control/presets";

const ringingAtDamping = (kd: number) =>
  ringingFromDamping(
    analyseLoop({ ...DEFAULT_SETTINGS.gains, kd }, DEFAULT_SETTINGS.plant).zeta,
  );

describe("ringingFromDamping", () => {
  it("treats an unstable loop as maximum ring", () => {
    expect(ringingFromDamping(-0.1)).toBe(1);
    expect(ringingFromDamping(0)).toBe(1);
  });

  it("silences a critically damped one", () => {
    expect(ringingFromDamping(1)).toBe(0);
    expect(ringingFromDamping(1.6)).toBe(0);
  });

  it("falls monotonically between the two", () => {
    const samples = [0.1, 0.3, 0.5, 0.7, 0.9].map(ringingFromDamping);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1]);
    }
  });

  it("survives values that are not numbers", () => {
    expect(ringingFromDamping(Number.NaN)).toBe(1);
  });
});

/**
 * The regression this exists for.
 *
 * ζ is *not* monotonic in kd — winding derivative action far up produces a slow,
 * lightly damped pair, so ζ peaks in the middle of the slider and falls at both ends.
 * Driving the shader with raw ζ therefore made the extremes look identical, which is
 * exactly how the bug was found: dragging the control to both ends changed nothing.
 */
describe("the Damping slider must be visibly different across its range", () => {
  it("keeps ζ non-monotonic — the fact that caused the bug", () => {
    const middle = analyseLoop(
      { ...DEFAULT_SETTINGS.gains, kd: 20 },
      DEFAULT_SETTINGS.plant,
    ).zeta;
    const top = analyseLoop(
      { ...DEFAULT_SETTINGS.gains, kd: 300 },
      DEFAULT_SETTINGS.plant,
    ).zeta;

    expect(middle).toBeGreaterThan(top);
  });

  it("separates no damping from well damped", () => {
    // The comparison a visitor actually makes when told to "take the damping out".
    expect(ringingAtDamping(0) - ringingAtDamping(28)).toBeGreaterThan(0.5);
  });

  it("separates well damped from over-damped", () => {
    // Both ends ring; the middle does not. The visuals have to show all three.
    expect(ringingAtDamping(300) - ringingAtDamping(28)).toBeGreaterThan(0.25);
  });
});
