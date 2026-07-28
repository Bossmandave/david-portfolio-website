/**
 * Fixed-timestep accumulator.
 *
 * A control loop integrated at the display's variable frame delta is not the same system
 * on a 60 Hz panel as on a 144 Hz one — the discretisation changes, so the tuning
 * changes, so the *feel* changes. Everything here runs at a fixed 240 Hz regardless of
 * refresh rate, and the renderer consumes whatever the simulation last produced.
 *
 * `maxSubSteps` caps the catch-up work after a stall (tab backgrounded, long task). The
 * alternative is the spiral of death: a slow frame demands more substeps, which makes
 * the next frame slower still.
 */
export class FixedClock {
  readonly dt: number;
  private accumulator = 0;
  private last = 0;
  private started = false;

  /** Wall-clock seconds discarded by the substep cap on the previous advance. */
  droppedTime = 0;

  constructor(
    readonly hz = 240,
    readonly maxSubSteps = 8,
  ) {
    this.dt = 1 / hz;
  }

  /**
   * Feed a timestamp (ms, monotonic) and receive the number of fixed steps to run.
   */
  advance(nowMs: number): number {
    if (!this.started) {
      this.last = nowMs;
      this.started = true;
      return 0;
    }

    const elapsed = (nowMs - this.last) / 1000;
    this.last = nowMs;
    this.droppedTime = 0;

    // Guard against negative or absurd deltas from clock adjustments and tab restores.
    if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;

    this.accumulator += Math.min(elapsed, this.maxSubSteps * this.dt);

    let steps = 0;
    while (this.accumulator >= this.dt && steps < this.maxSubSteps) {
      this.accumulator -= this.dt;
      steps++;
    }

    if (this.accumulator >= this.dt) {
      this.droppedTime = this.accumulator;
      this.accumulator = 0;
    }

    return steps;
  }

  /** Fraction of a step remaining, for interpolating render position between substeps. */
  get alpha(): number {
    return this.accumulator / this.dt;
  }

  reset(): void {
    this.accumulator = 0;
    this.started = false;
    this.droppedTime = 0;
  }
}
