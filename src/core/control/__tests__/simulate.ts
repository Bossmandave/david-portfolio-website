import {
  DEFAULT_PID_OPTIONS,
  PidController,
  type PidGains,
  type PidOptions,
} from "@/core/control/pid";
import type { StepSample } from "@/core/control/metrics";
import {
  DEFAULT_PLANT,
  SecondOrderPlant,
  type PlantConfig,
} from "@/core/control/plant";

export interface SimulationOptions {
  gains: PidGains;
  setpoint: number;
  duration: number;
  plant?: Partial<PlantConfig>;
  pid?: Partial<PidOptions>;
  /** Finer than the runtime's 240 Hz so discretisation error does not muddy assertions. */
  dt?: number;
}

export interface SimulationResult {
  samples: StepSample[];
  plant: SecondOrderPlant;
  controller: PidController;
  final: number;
}

/**
 * Runs a closed loop from rest against a constant setpoint.
 *
 * Defaults deliberately strip the practical safeguards — no derivative filtering, an
 * effectively unbounded actuator, and no load — so the loop matches the textbook
 * second-order form and can be checked against analytic predictions. Tests that care
 * about saturation, windup or droop opt back in explicitly.
 */
export function simulateStep(options: SimulationOptions): SimulationResult {
  const dt = options.dt ?? 1 / 2000;

  const plant = new SecondOrderPlant({
    ...DEFAULT_PLANT,
    load: 0,
    ...options.plant,
  });

  const controller = new PidController(
    { ...options.gains },
    {
      ...DEFAULT_PID_OPTIONS,
      derivativeFilter: 0,
      outputLimit: 1e12,
      ...options.pid,
    },
  );

  const samples: StepSample[] = [];
  const steps = Math.round(options.duration / dt);

  for (let i = 0; i <= steps; i++) {
    samples.push({ t: i * dt, value: plant.position });
    const u = controller.update(options.setpoint, plant.position, dt);
    plant.step(u, dt);
  }

  return { samples, plant, controller, final: plant.position };
}

/** Analytic unit-step response of a second-order system, for validating the analyser. */
export function analyticStepResponse(
  zeta: number,
  omegaN: number,
  duration: number,
  dt = 1 / 2000,
): StepSample[] {
  const samples: StepSample[] = [];
  const omegaD = omegaN * Math.sqrt(1 - zeta * zeta);
  const phi = Math.acos(zeta);

  for (let t = 0; t <= duration; t += dt) {
    const envelope = Math.exp(-zeta * omegaN * t) / Math.sqrt(1 - zeta * zeta);
    samples.push({ t, value: 1 - envelope * Math.sin(omegaD * t + phi) });
  }

  return samples;
}
