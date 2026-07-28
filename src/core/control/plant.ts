export interface PlantConfig {
  /** Inertia. Sets how hard the controller has to work to change velocity. */
  mass: number;
  /** Viscous friction intrinsic to the plant, independent of the controller's kd. */
  damping: number;
  /**
   * A constant disturbance force acting on the plant — think gravity on an arm, or a
   * spring pulling it off-target.
   *
   * This is the reason integral action exists. With ki = 0 the loop settles where
   * proportional effort balances the load, leaving a permanent offset of −load/kp:
   * visible droop. Integral action winds up until it cancels the load exactly and the
   * droop goes to zero. Without a load term, ki has nothing to do and is pure liability.
   */
  load: number;
}

export const DEFAULT_PLANT: PlantConfig = {
  mass: 1,
  damping: 0.5,
  load: 6_000,
};

/** Beyond this displacement the simulation is considered to have blown up. */
const DIVERGENCE_LIMIT = 1e7;

/**
 * A second-order plant: mass, viscous damping, and a constant load.
 *
 *   m·ẍ = u + load − b·ẋ
 *
 * Integrated with semi-implicit (symplectic) Euler, which stays stable on oscillatory
 * systems at timesteps where explicit Euler quietly injects energy and diverges.
 */
export class SecondOrderPlant {
  position = 0;
  velocity = 0;
  acceleration = 0;
  diverged = false;

  constructor(public config: PlantConfig = { ...DEFAULT_PLANT }) {}

  /** Advance one fixed timestep under control effort `u`. */
  step(u: number, dt: number): number {
    if (this.diverged) return this.position;

    const { mass, damping, load } = this.config;

    this.acceleration = (u + load - damping * this.velocity) / mass;
    this.velocity += this.acceleration * dt;
    this.position += this.velocity * dt;

    if (
      !Number.isFinite(this.position) ||
      Math.abs(this.position) > DIVERGENCE_LIMIT
    ) {
      this.diverged = true;
    }

    return this.position;
  }

  reset(position = 0): void {
    this.position = position;
    this.velocity = 0;
    this.acceleration = 0;
    this.diverged = false;
  }
}
