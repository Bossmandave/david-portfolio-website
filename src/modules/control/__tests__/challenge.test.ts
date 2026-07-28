import { describe, expect, it } from "vitest";

import { evaluateChallenge } from "@/modules/control/challenge";
import { DEFAULT_SETTINGS, cloneSettings } from "@/modules/control/presets";
import { ControlSystem, type LoopSettings } from "@/modules/control/system";

const HZ = 240;
const DT = 1 / HZ;

/**
 * Drives the same step sequence the browser runs, in Node, against the same core.
 * No DOM involved — the loop is pure TypeScript, which is exactly why it can be
 * tested at all.
 */
function runStepTest(gains: LoopSettings["gains"]) {
  const settings = cloneSettings(DEFAULT_SETTINGS);
  settings.gains = { ...gains };

  const system = new ControlSystem(settings, HZ);
  system.setBounds(1000, 600);
  system.reset();
  system.beginStepTest();

  // Arming (0.8s) plus capture (2.5s), with headroom.
  for (let i = 0; i < HZ * 6; i++) system.simulate(DT);

  return system.metrics;
}

describe("tuning challenge", () => {
  /**
   * The point of this test: a challenge nobody can win is a bug, not a difficulty
   * setting. If the plant is ever retuned in a way that puts the target out of reach,
   * this fails before anyone ships it.
   */
  it("is winnable", () => {
    // Found by searching the space, not by the textbook formula — which predicts a
    // comfortable pass for tunes that overshoot by 40% once ki is switched on.
    const result = evaluateChallenge(runStepTest({ kp: 600, ki: 1200, kd: 40 }));

    expect(result.attempted).toBe(true);
    expect(
      result.conditions.filter((condition) => !condition.met),
      "a known-good tune must satisfy every condition",
    ).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("is not won by the tuning the page loads with", () => {
    // If the default already passed, there would be nothing to discover.
    expect(evaluateChallenge(runStepTest(DEFAULT_SETTINGS.gains)).passed).toBe(
      false,
    );
  });

  it("needs integral action — speed and damping alone leave the load uncancelled", () => {
    const result = evaluateChallenge(runStepTest({ kp: 600, ki: 0, kd: 40 }));
    const offset = result.conditions.find((c) => c.id === "offset");

    expect(offset?.met, "no ki means a permanent offset").toBe(false);
  });

  it("needs derivative action — speed alone overshoots", () => {
    const result = evaluateChallenge(runStepTest({ kp: 600, ki: 1200, kd: 4 }));
    const overshoot = result.conditions.find((c) => c.id === "overshoot");

    expect(overshoot?.met, "too little kd must break the overshoot bound").toBe(
      false,
    );
  });

  it("punishes too much integral action, which the textbook ζ does not predict", () => {
    // Same speed and damping, far more ki. The dominant pair loses damping to the
    // third pole and the response overshoots badly — the trap the honest ζ readout
    // exists to expose.
    const result = evaluateChallenge(runStepTest({ kp: 600, ki: 6000, kd: 40 }));
    expect(result.passed).toBe(false);
  });

  it("reports nothing before a step has been run", () => {
    const idle = evaluateChallenge(null);
    expect(idle.attempted).toBe(false);
    expect(idle.conditions.every((condition) => !condition.met)).toBe(true);
  });
});
