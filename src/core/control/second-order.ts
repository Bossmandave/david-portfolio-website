/**
 * A second-order system parameterised the way a control engineer specifies one:
 * by damping ratio and natural frequency, not by stiffness and a duration.
 *
 *   ẍ = ωₙ²·(target − x) − 2ζωₙ·ẋ
 *
 * This is a PD controller on a unit mass — which is the honest reason it is *not* a
 * `PidController` here. The ambient motion loop has no load and no persistent
 * disturbance, so integral action would have nothing to cancel and would only
 * contribute windup. The full PID belongs where a load exists; everywhere else, this.
 */
export class SecondOrder {
  value: number;
  velocity = 0;
  target: number;

  constructor(
    public zeta: number,
    public omegaN: number,
    initial = 0,
  ) {
    this.value = initial;
    this.target = initial;
  }

  step(dt: number): number {
    const acceleration =
      this.omegaN * this.omegaN * (this.target - this.value) -
      2 * this.zeta * this.omegaN * this.velocity;

    // Semi-implicit Euler: velocity first, then position from the new velocity.
    this.velocity += acceleration * dt;
    this.value += this.velocity * dt;

    return this.value;
  }

  /** Within 0.5% of target and effectively stationary. */
  get settled(): boolean {
    const span = Math.abs(this.target - this.value);
    return span < 0.005 && Math.abs(this.velocity) < 0.005;
  }

  /** Time to stay inside ±2%, from the standard approximation. */
  get settlingTime(): number {
    return this.zeta > 0 && this.omegaN > 0
      ? 4 / (this.zeta * this.omegaN)
      : Number.POSITIVE_INFINITY;
  }

  snap(value: number): void {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }
}
