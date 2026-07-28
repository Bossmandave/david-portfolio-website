import { describe, expect, it } from "vitest";

import { analyseStepResponse, type StepSample } from "@/core/control/metrics";
import { SecondOrder } from "@/core/control/second-order";
import { MOTION, criticallyDamped } from "@/design/motion";

const DT = 1 / 2000;

function runToTarget(system: SecondOrder, seconds: number): StepSample[] {
  const samples: StepSample[] = [];
  const steps = Math.round(seconds / DT);
  for (let i = 0; i <= steps; i++) {
    samples.push({ t: i * DT, value: system.value });
    system.step(DT);
  }
  return samples;
}

describe("SecondOrder", () => {
  it("reaches its target and stops", () => {
    const system = new SecondOrder(1, 20);
    system.target = 1;
    runToTarget(system, 2);

    expect(system.value).toBeCloseTo(1, 3);
    expect(system.settled).toBe(true);
  });

  it("reports settling time from ζ and ωₙ, not from a duration", () => {
    const system = new SecondOrder(0.5, 10);
    expect(system.settlingTime).toBeCloseTo(0.8, 6);
  });
});

/**
 * The motion tokens are design decisions, so they get asserted like any other
 * requirement. If someone retunes `arrive` and the overshoot leaves its band, this
 * fails — which is the point of expressing motion as numbers rather than as vibes.
 */
describe("motion tokens", () => {
  it("gives `arrive` the overshoot its damping ratio predicts", () => {
    const token = MOTION.arrive;
    const system = new SecondOrder(token.zeta, token.omegaN);
    system.target = 1;

    const measured = analyseStepResponse(runToTarget(system, 3), 0, 1);
    const predicted = Math.exp(
      (-Math.PI * token.zeta) / Math.sqrt(1 - token.zeta * token.zeta),
    );

    expect(predicted).toBeCloseTo(0.083, 2);
    expect(measured.overshoot).toBeCloseTo(predicted, 2);
  });

  it("never overshoots on `settle`", () => {
    const token = MOTION.settle;
    const system = new SecondOrder(token.zeta, token.omegaN);
    system.target = 1;

    const measured = analyseStepResponse(runToTarget(system, 2), 0, 1);
    expect(measured.overshoot).toBeLessThan(0.001);
  });

  it("removes overshoot from every token under reduced motion", () => {
    for (const token of Object.values(MOTION)) {
      const tuned = criticallyDamped(token);
      const system = new SecondOrder(tuned.zeta, tuned.omegaN);
      system.target = 1;

      const measured = analyseStepResponse(runToTarget(system, 3), 0, 1);

      expect(tuned.zeta).toBe(1);
      expect(measured.overshoot).toBeLessThan(0.001);
      // And it arrives sooner than the unreduced tuning would have.
      expect(tuned.omegaN).toBeGreaterThan(token.omegaN);
    }
  });
});
