import { clamp } from "@/core/math/clamp";

export interface PidGains {
  /** Proportional. Reacts to present error. Raising it speeds response and adds overshoot. */
  kp: number;
  /** Integral. Reacts to accumulated error. Eliminates steady-state droop under load. */
  ki: number;
  /** Derivative. Reacts to rate of change. Adds damping, resists overshoot. */
  kd: number;
}

export interface PidOptions {
  /** Symmetric saturation on control effort. Real actuators cannot push infinitely hard. */
  outputLimit: number;
  /**
   * Back-calculation anti-windup. When the output saturates, the integrator is bled
   * back toward a value consistent with the achievable output. Disable to observe
   * classic integral windup: the loop overshoots badly after a long saturated push.
   */
  antiWindup: boolean;
  /**
   * Differentiating the error produces a derivative "kick" — an impulse in the output
   * whenever the setpoint steps, because de/dt is momentarily infinite. Differentiating
   * the measurement instead is equivalent in steady tracking and kick-free on steps.
   */
  derivativeSource: "measurement" | "error";
  /** First-order low-pass on the derivative term, 0 (off) to 0.99. Tames sensor noise. */
  derivativeFilter: number;
}

export const DEFAULT_PID_OPTIONS: PidOptions = {
  outputLimit: 40_000,
  antiWindup: true,
  derivativeSource: "measurement",
  derivativeFilter: 0.4,
};

export interface PidTelemetry {
  error: number;
  /** Contribution of each term to the final output, for visualisation. */
  p: number;
  i: number;
  d: number;
  output: number;
  saturated: boolean;
}

/**
 * A discrete PID controller.
 *
 * The integral term stores its own *contribution* (ki · ∫e dt) rather than the raw
 * integral (∫e dt). This makes retuning bumpless: changing ki alters how fast the term
 * accumulates from now on, but does not instantaneously jump the output — which is what
 * you want when a human is dragging a slider attached to a live loop.
 */
export class PidController {
  private integral = 0;
  private previousError = 0;
  private previousMeasurement = 0;
  private filteredDerivative = 0;
  private primed = false;

  readonly telemetry: PidTelemetry = {
    error: 0,
    p: 0,
    i: 0,
    d: 0,
    output: 0,
    saturated: false,
  };

  constructor(
    public gains: PidGains,
    public options: PidOptions = { ...DEFAULT_PID_OPTIONS },
  ) {}

  /**
   * Advance one fixed timestep and return the control effort.
   *
   * @param setpoint    where we want the process variable to be
   * @param measurement where it actually is
   * @param dt          fixed timestep in seconds
   */
  update(setpoint: number, measurement: number, dt: number): number {
    const { kp, ki, kd } = this.gains;
    const { outputLimit, antiWindup, derivativeSource, derivativeFilter } =
      this.options;

    const error = setpoint - measurement;

    // On the first step there is no previous sample, so any derivative would be a
    // fabricated impulse. Seed the history and emit proportional action only.
    if (!this.primed) {
      this.previousError = error;
      this.previousMeasurement = measurement;
      this.primed = true;
    }

    const p = kp * error;

    this.integral += ki * error * dt;

    let rawDerivative: number;
    if (derivativeSource === "measurement") {
      // d(error)/dt = d(setpoint)/dt − d(measurement)/dt. Dropping the setpoint term
      // removes the kick; the sign flip is why this is negated.
      rawDerivative = -(measurement - this.previousMeasurement) / dt;
    } else {
      rawDerivative = (error - this.previousError) / dt;
    }

    const alpha = 1 - clamp(derivativeFilter, 0, 0.99);
    this.filteredDerivative += alpha * (rawDerivative - this.filteredDerivative);
    const d = kd * this.filteredDerivative;

    const unsaturated = p + this.integral + d;
    const output = clamp(unsaturated, -outputLimit, outputLimit);
    const saturated = output !== unsaturated;

    if (antiWindup && saturated) {
      // Bleed the integrator toward consistency with the achievable output. The tracking
      // gain sets how fast; 1/dt fully corrects within one step, which is aggressive but
      // stable here because the integrator is the only unbounded state we hold.
      this.integral += output - unsaturated;
    }

    this.previousError = error;
    this.previousMeasurement = measurement;

    const t = this.telemetry;
    t.error = error;
    t.p = p;
    t.i = this.integral;
    t.d = d;
    t.output = output;
    t.saturated = saturated;

    return output;
  }

  /** Clears accumulated state. Use when the plant is teleported or the loop restarts. */
  reset(): void {
    this.integral = 0;
    this.previousError = 0;
    this.previousMeasurement = 0;
    this.filteredDerivative = 0;
    this.primed = false;
    this.telemetry.error = 0;
    this.telemetry.p = 0;
    this.telemetry.i = 0;
    this.telemetry.d = 0;
    this.telemetry.output = 0;
    this.telemetry.saturated = false;
  }
}
