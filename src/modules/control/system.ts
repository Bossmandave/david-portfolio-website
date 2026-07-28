import {
  analyseStepResponse,
  type StepMetrics,
  type StepSample,
} from "@/core/control/metrics";
import { PidController, type PidGains, type PidOptions } from "@/core/control/pid";
import { SecondOrderPlant, type PlantConfig } from "@/core/control/plant";
import { RingBuffer } from "@/core/signal/ring-buffer";

export interface LoopSettings {
  gains: PidGains;
  plant: PlantConfig;
  options: PidOptions;
}

/** Rolling scope window. Decimated from the 240Hz simulation to 60Hz for drawing. */
const SCOPE_HZ = 60;
const SCOPE_WINDOW_SECONDS = 4;
const SCOPE_SAMPLES = SCOPE_HZ * SCOPE_WINDOW_SECONDS;

const STEP_ARM_SECONDS = 0.8;
const STEP_CAPTURE_SECONDS = 2.5;
const STEP_FROM_RATIO = 0.34;
const STEP_TO_RATIO = 0.68;

export type StepPhase = "idle" | "arming" | "capturing";

/**
 * Two independent single-axis loops driving one visible object.
 *
 * The load — the constant disturbance that gives integral action something to do — is
 * applied to the vertical axis only, so it reads as gravity. That makes droop legible
 * without explanation: with ki at zero the object hangs below the cursor, and winding ki
 * up hauls it back onto target. The horizontal axis carries no load, so the same gains
 * track cleanly there and the difference between the two axes is itself the lesson.
 */
export class ControlSystem {
  readonly pidX: PidController;
  readonly pidY: PidController;
  readonly plantX: SecondOrderPlant;
  readonly plantY: SecondOrderPlant;

  readonly setpoint = { x: 0, y: 0 };
  readonly bounds = { width: 0, height: 0 };

  /** Vertical axis only — the one carrying the load, so one trace tells the whole story. */
  readonly scopeSetpoint = new RingBuffer(SCOPE_SAMPLES);
  readonly scopeMeasured = new RingBuffer(SCOPE_SAMPLES);

  stepPhase: StepPhase = "idle";
  metrics: StepMetrics | null = null;
  /** Increments whenever a capture completes, so readouts know to re-sample. */
  metricsRevision = 0;

  private scopeDecimator = 0;
  private readonly scopeInterval: number;
  private stepClock = 0;
  private stepSamples: StepSample[] = [];
  private stepFrom = 0;
  private stepTo = 0;

  constructor(settings: LoopSettings, simulationHz = 240) {
    this.scopeInterval = Math.max(1, Math.round(simulationHz / SCOPE_HZ));

    this.pidX = new PidController({ ...settings.gains }, { ...settings.options });
    this.pidY = new PidController({ ...settings.gains }, { ...settings.options });
    this.plantX = new SecondOrderPlant({ ...settings.plant, load: 0 });
    this.plantY = new SecondOrderPlant({ ...settings.plant });
  }

  /**
   * Push new settings into the live loop without restarting it.
   *
   * Mutating the existing controllers rather than replacing them is what makes dragging
   * a slider feel like turning a knob on running hardware instead of rebooting it.
   */
  applySettings(settings: LoopSettings): void {
    Object.assign(this.pidX.gains, settings.gains);
    Object.assign(this.pidY.gains, settings.gains);
    Object.assign(this.pidX.options, settings.options);
    Object.assign(this.pidY.options, settings.options);
    Object.assign(this.plantX.config, settings.plant, { load: 0 });
    Object.assign(this.plantY.config, settings.plant);
  }

  setBounds(width: number, height: number): void {
    this.bounds.width = width;
    this.bounds.height = height;
  }

  /** Ignored while a step test is running, so the measurement stays clean. */
  setTarget(x: number, y: number): void {
    if (this.stepPhase !== "idle") return;
    this.setpoint.x = x;
    this.setpoint.y = y;
  }

  get diverged(): boolean {
    return this.plantX.diverged || this.plantY.diverged;
  }

  simulate(dt: number): void {
    this.advanceStepSequence(dt);

    const ux = this.pidX.update(this.setpoint.x, this.plantX.position, dt);
    this.plantX.step(ux, dt);

    const uy = this.pidY.update(this.setpoint.y, this.plantY.position, dt);
    this.plantY.step(uy, dt);

    if (this.stepPhase === "capturing") {
      this.stepSamples.push({ t: this.stepClock, value: this.plantY.position });
    }

    if (++this.scopeDecimator >= this.scopeInterval) {
      this.scopeDecimator = 0;
      this.scopeSetpoint.push(this.setpoint.y);
      this.scopeMeasured.push(this.plantY.position);
    }
  }

  /** Runs a clean vertical step: settle at a known height, then command a jump. */
  beginStepTest(): void {
    if (this.stepPhase !== "idle" || this.bounds.height === 0) return;

    this.stepPhase = "arming";
    this.stepClock = 0;
    this.stepSamples = [];
    this.setpoint.x = this.bounds.width * 0.5;
    this.setpoint.y = this.bounds.height * STEP_FROM_RATIO;
  }

  cancelStepTest(): void {
    this.stepPhase = "idle";
    this.stepSamples = [];
    this.stepClock = 0;
  }

  private advanceStepSequence(dt: number): void {
    if (this.stepPhase === "idle") return;
    this.stepClock += dt;

    if (this.stepPhase === "arming") {
      if (this.stepClock < STEP_ARM_SECONDS) return;

      this.stepFrom = this.plantY.position;
      this.stepTo = this.bounds.height * STEP_TO_RATIO;
      this.setpoint.y = this.stepTo;
      this.stepPhase = "capturing";
      this.stepClock = 0;
      return;
    }

    if (this.stepClock >= STEP_CAPTURE_SECONDS || this.diverged) {
      this.metrics = analyseStepResponse(
        this.stepSamples,
        this.stepFrom,
        this.stepTo,
      );
      this.metricsRevision++;
      this.stepPhase = "idle";
      this.stepSamples = [];
    }
  }

  reset(): void {
    const { width, height } = this.bounds;
    this.pidX.reset();
    this.pidY.reset();
    this.plantX.reset(width * 0.5);
    this.plantY.reset(height * 0.5);
    this.setpoint.x = width * 0.5;
    this.setpoint.y = height * 0.5;
    this.scopeSetpoint.clear();
    this.scopeMeasured.clear();
    this.cancelStepTest();
    this.metrics = null;
    this.metricsRevision++;
  }
}
