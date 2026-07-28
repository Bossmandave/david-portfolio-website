import { describe, expect, it } from "vitest";

import { analyseLoop } from "@/core/control/analysis";
import { analyseStepResponse } from "@/core/control/metrics";
import { DEFAULT_PID_OPTIONS, PidController } from "@/core/control/pid";
import { simulateStep } from "./simulate";

const DT = 1 / 2000;

describe("PidController — term behaviour", () => {
  it("emits proportional effort in proportion to error", () => {
    const pid = new PidController(
      { kp: 10, ki: 0, kd: 0 },
      { ...DEFAULT_PID_OPTIONS, derivativeFilter: 0 },
    );

    expect(pid.update(5, 0, DT)).toBeCloseTo(50, 6);
    expect(pid.update(10, 0, DT)).toBeCloseTo(100, 6);
    expect(pid.update(0, 0, DT)).toBeCloseTo(0, 6);
  });

  it("accumulates integral effort while error persists", () => {
    const pid = new PidController(
      { kp: 0, ki: 4, kd: 0 },
      { ...DEFAULT_PID_OPTIONS, derivativeFilter: 0 },
    );

    // One second of unit error at ki = 4 accumulates 4 units of effort.
    for (let i = 0; i < 2000; i++) pid.update(1, 0, DT);

    expect(pid.update(1, 0, DT)).toBeCloseTo(4, 1);
  });

  it("keeps retuning bumpless — changing ki does not jump the output", () => {
    const pid = new PidController(
      { kp: 0, ki: 4, kd: 0 },
      { ...DEFAULT_PID_OPTIONS, derivativeFilter: 0 },
    );

    for (let i = 0; i < 2000; i++) pid.update(1, 0, DT);
    const before = pid.telemetry.output;

    pid.gains.ki = 400; // ×100
    const after = pid.update(1, 0, DT);

    // The new gain changes how fast the term grows from here — one step's worth — but
    // leaves what has already accumulated alone. A controller storing raw ∫e dt would
    // have multiplied its output by 100 on this single step.
    expect(after).toBeCloseTo(before + 400 * DT, 6);
    expect(after - before).toBeLessThan(0.25);
  });
});

describe("PidController — derivative kick", () => {
  const settle = (pid: PidController) => {
    for (let i = 0; i < 50; i++) pid.update(0, 0, DT);
  };

  it("kicks hard when differentiating the error", () => {
    const pid = new PidController(
      { kp: 1, ki: 0, kd: 10 },
      {
        ...DEFAULT_PID_OPTIONS,
        derivativeFilter: 0,
        derivativeSource: "error",
      },
    );
    settle(pid);

    // Setpoint steps 0 → 1 with the plant stationary: de/dt is 1/dt.
    const output = pid.update(1, 0, DT);
    expect(output).toBeCloseTo(1 + 10 / DT, 0);
    expect(output).toBeGreaterThan(10_000);
  });

  it("does not kick when differentiating the measurement", () => {
    const pid = new PidController(
      { kp: 1, ki: 0, kd: 10 },
      {
        ...DEFAULT_PID_OPTIONS,
        derivativeFilter: 0,
        derivativeSource: "measurement",
      },
    );
    settle(pid);

    // The measurement has not moved, so there is nothing to differentiate.
    expect(pid.update(1, 0, DT)).toBeCloseTo(1, 6);
  });
});

describe("closed loop — analytic agreement", () => {
  // ωₙ = √(kp/m) = 10 rad/s; ζ = (b + kd) / 2√(kp·m).
  const plant = { mass: 1, damping: 0.5, load: 0 };

  it("matches the predicted overshoot for an underdamped tuning", () => {
    const gains = { kp: 100, ki: 0, kd: 9.5 }; // ζ = 0.5
    const analysis = analyseLoop(gains, { ...plant });

    expect(analysis.omegaN).toBeCloseTo(10, 6);
    expect(analysis.zeta).toBeCloseTo(0.5, 6);
    expect(analysis.dampingRegime).toBe("underdamped");

    const { samples } = simulateStep({
      gains,
      plant,
      setpoint: 1,
      duration: 3,
    });
    const measured = analyseStepResponse(samples, 0, 1);

    // exp(−πζ/√(1−ζ²)) ≈ 0.163
    expect(analysis.predictedOvershoot).toBeCloseTo(0.163, 2);
    expect(measured.overshoot).toBeCloseTo(analysis.predictedOvershoot, 2);
  });

  it("produces effectively no overshoot when critically damped", () => {
    const gains = { kp: 100, ki: 0, kd: 19.5 }; // ζ = 1.0
    const analysis = analyseLoop(gains, { ...plant });

    expect(analysis.zeta).toBeCloseTo(1, 6);
    expect(analysis.dampingRegime).toBe("critically damped");

    const { samples } = simulateStep({
      gains,
      plant,
      setpoint: 1,
      duration: 3,
    });
    const measured = analyseStepResponse(samples, 0, 1);

    expect(measured.overshoot).toBeLessThan(0.001);
    expect(measured.settled).toBe(true);
  });

  it("rings for a long time with no derivative action", () => {
    const gains = { kp: 100, ki: 0, kd: 0 };
    const analysis = analyseLoop(gains, { ...plant });

    // Stripped of derivative action, the only damping left is the plant's own friction.
    expect(analysis.zeta).toBeCloseTo(0.025, 3);
    expect(analysis.dampingRegime).toBe("underdamped");

    const { samples } = simulateStep({
      gains,
      plant,
      setpoint: 1,
      duration: 3,
    });
    const measured = analyseStepResponse(samples, 0, 1);

    // Only the plant's own friction damps it, so it nearly doubles the target.
    expect(measured.overshoot).toBeGreaterThan(0.9);
    expect(measured.settled).toBe(false);
  });
});

describe("closed loop — integral action against a load", () => {
  const plant = { mass: 1, damping: 0.5, load: 500 };
  const setpoint = 100;

  it("leaves steady-state droop of load/kp with no integral action", () => {
    const gains = { kp: 100, ki: 0, kd: 19.5 };
    const analysis = analyseLoop(gains, plant);

    expect(analysis.droop).toBeCloseTo(5, 6);

    const { final } = simulateStep({ gains, plant, setpoint, duration: 6 });

    // The loop parks where proportional effort balances the load, not on target.
    expect(final - setpoint).toBeCloseTo(5, 1);
  });

  it("eliminates that droop once integral action is switched on", () => {
    const gains = { kp: 100, ki: 300, kd: 19.5 };
    const { final } = simulateStep({ gains, plant, setpoint, duration: 6 });

    expect(Math.abs(final - setpoint)).toBeLessThan(0.05);
  });
});

describe("closed loop — Routh–Hurwitz stability boundary", () => {
  const plant = { mass: 1, damping: 0.5, load: 0 };
  const kd = 9.5;
  const kp = 100;
  // (b + kd)·kp / m
  const kiCritical = (0.5 + kd) * kp;

  it("reports the critical ki", () => {
    expect(analyseLoop({ kp, ki: 0, kd }, plant).kiCritical).toBeCloseTo(
      kiCritical,
      6,
    );
  });

  it("stays bounded below the boundary", () => {
    const ki = kiCritical * 0.25;
    expect(analyseLoop({ kp, ki, kd }, plant).stability).toBe("stable");

    const { plant: sim, final } = simulateStep({
      gains: { kp, ki, kd },
      plant,
      setpoint: 1,
      duration: 8,
    });

    expect(sim.diverged).toBe(false);
    expect(final).toBeCloseTo(1, 2);
  });

  it("diverges above the boundary", () => {
    const ki = kiCritical * 5;
    expect(analyseLoop({ kp, ki, kd }, plant).stability).toBe("unstable");

    const { plant: sim } = simulateStep({
      gains: { kp, ki, kd },
      plant,
      setpoint: 1,
      duration: 8,
    });

    expect(sim.diverged).toBe(true);
  });
});

describe("anti-windup", () => {
  // A distant setpoint behind a weak actuator: the controller saturates for seconds
  // while the integrator keeps accumulating error it cannot act on.
  const shared = {
    gains: { kp: 5, ki: 50, kd: 2 },
    plant: { mass: 1, damping: 0.5, load: 0 },
    setpoint: 500,
    duration: 20,
  } as const;

  it("substantially reduces overshoot after a long saturated push", () => {
    const withAntiWindup = analyseStepResponse(
      simulateStep({
        ...shared,
        pid: { outputLimit: 100, antiWindup: true, derivativeFilter: 0 },
      }).samples,
      0,
      shared.setpoint,
    );

    const withoutAntiWindup = analyseStepResponse(
      simulateStep({
        ...shared,
        pid: { outputLimit: 100, antiWindup: false, derivativeFilter: 0 },
      }).samples,
      0,
      shared.setpoint,
    );

    expect(withoutAntiWindup.overshoot).toBeGreaterThan(
      withAntiWindup.overshoot * 2,
    );
  });
});
