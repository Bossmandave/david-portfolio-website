import { describe, expect, it } from "vitest";

import { analyseStepResponse, type StepSample } from "@/core/control/metrics";
import { analyticStepResponse } from "./simulate";

describe("analyseStepResponse", () => {
  it("recovers textbook figures from an analytic second-order response", () => {
    const zeta = 0.5;
    const omegaN = 10;
    const samples = analyticStepResponse(zeta, omegaN, 3);
    const metrics = analyseStepResponse(samples, 0, 1);

    // Mp = exp(−πζ/√(1−ζ²))
    expect(metrics.overshoot).toBeCloseTo(0.163, 2);
    // tp = π/ωd
    expect(metrics.peakTime).toBeCloseTo(
      Math.PI / (omegaN * Math.sqrt(1 - zeta * zeta)),
      2,
    );
    // ts ≈ 4/ζωn, reached at a discrete oscillation peak so only roughly.
    expect(metrics.settlingTime).toBeGreaterThan(0.5);
    expect(metrics.settlingTime).toBeLessThan(1.1);
    expect(metrics.settled).toBe(true);
  });

  it("reports no overshoot for a monotonic approach", () => {
    const samples: StepSample[] = [];
    for (let t = 0; t <= 3; t += 0.001) {
      samples.push({ t, value: 1 - Math.exp(-5 * t) });
    }

    const metrics = analyseStepResponse(samples, 0, 1);

    expect(metrics.overshoot).toBe(0);
    expect(metrics.peakTime).toBeCloseTo(3, 1);
    expect(metrics.settled).toBe(true);
  });

  it("handles a downward step identically to an upward one", () => {
    const up = analyticStepResponse(0.5, 10, 3);
    const down = up.map((s) => ({ t: s.t, value: 100 - s.value * 100 }));

    const metrics = analyseStepResponse(down, 100, 0);

    expect(metrics.overshoot).toBeCloseTo(0.163, 2);
  });

  it("refuses to declare settling when the signal never enters the band", () => {
    const samples: StepSample[] = [];
    for (let t = 0; t <= 2; t += 0.001) {
      samples.push({ t, value: 0.5 + 0.3 * Math.sin(20 * t) });
    }

    const metrics = analyseStepResponse(samples, 0, 1);

    expect(metrics.settlingTime).toBeNull();
    expect(metrics.settled).toBe(false);
  });

  it("measures residual steady-state error", () => {
    const samples: StepSample[] = [];
    for (let t = 0; t <= 3; t += 0.001) {
      samples.push({ t, value: 0.9 * (1 - Math.exp(-8 * t)) });
    }

    const metrics = analyseStepResponse(samples, 0, 1);

    expect(metrics.steadyStateError).toBeCloseTo(0.1, 2);
    expect(metrics.settled).toBe(false);
  });

  it("degrades safely on empty or zero-magnitude input", () => {
    expect(analyseStepResponse([], 0, 1).settlingTime).toBeNull();
    expect(analyseStepResponse([{ t: 0, value: 1 }], 1, 1).overshoot).toBe(0);
  });
});
