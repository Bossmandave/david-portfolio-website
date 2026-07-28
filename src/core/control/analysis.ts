import type { PidGains } from "@/core/control/pid";
import type { PlantConfig } from "@/core/control/plant";

export type Stability = "stable" | "marginal" | "unstable";

export type DampingRegime =
  | "undamped"
  | "underdamped"
  | "critically damped"
  | "overdamped";

export interface LoopAnalysis {
  /** Natural frequency of the dominant pair, rad/s. */
  omegaN: number;
  /** Damping ratio of the dominant pair. 1.0 is the boundary of overshoot. */
  zeta: number;
  /**
   * The real pole contributed by integral action, rad/s. Zero when ki is off.
   * Reported because when it sits close to the dominant pair it stops being a
   * correction and starts being part of the response.
   */
  integralPole: number;
  dampingRegime: DampingRegime;
  stability: Stability;
  /** Largest ki this loop can carry before the third pole crosses into the RHP. */
  kiCritical: number;
  /** kiCritical / ki. Above 1 is stable; the closer to 1, the more it rings. */
  stabilityMargin: number;
  /** Predicted peak overshoot as a fraction of the step, from ζ alone. */
  predictedOvershoot: number;
  /** Predicted time to stay inside ±2%, seconds. */
  predictedSettlingTime: number;
  /** Offset the load will impose if integral action is switched off. */
  droop: number;
}

/**
 * Finds the single guaranteed real root of a monic cubic with positive coefficients,
 * by bracketing and bisection.
 *
 * Newton would be faster and would also need a good starting guess to avoid wandering
 * off a turning point. This runs at readout rate, not per frame, so robustness is worth
 * more than speed.
 */
function realRoot(a2: number, a1: number, a0: number): number {
  if (a0 === 0) return 0;

  const f = (s: number) => ((s + a2) * s + a1) * s + a0;

  // Cauchy's bound: every root lies inside this radius.
  let hi = 1 + Math.max(Math.abs(a2), Math.abs(a1), Math.abs(a0));
  let lo = 0;
  // f(0) = a0 > 0, so walk outward until the sign flips.
  let guard = 0;
  while (f(-hi) > 0 && guard++ < 64) hi *= 2;
  if (f(-hi) > 0) return 0;

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(-mid) > 0) lo = mid;
    else hi = mid;
  }

  return -(lo + hi) / 2;
}

/**
 * Closed-loop analysis for a PID controller driving a second-order plant.
 *
 * The characteristic polynomial is third order, because integral action adds a pole:
 *
 *   m·s³ + (b + kd)·s² + kp·s + ki = 0
 *
 * Rather than quote the ki = 0 approximation and hope nobody notices, the cubic is
 * factored: its real root is found numerically, the polynomial is deflated by it, and
 * ζ and ωₙ are read off the remaining quadratic. That matters because integral action
 * *takes damping away* from the dominant pair — a loop reading ζ 0.77 on the textbook
 * formula can actually be damping at 0.44 once ki is switched on, and a reader tuning
 * against the optimistic number will never understand why it keeps overshooting.
 *
 * Stability is exact and independent of all this: Routh–Hurwitz on the full cubic
 * reduces, for this form, to (b + kd)·kp > m·ki.
 */
export function analyseLoop(
  gains: PidGains,
  plant: PlantConfig,
): LoopAnalysis {
  const { kp, ki, kd } = gains;
  const { mass, damping, load } = plant;

  const totalDamping = damping + kd;

  // Monic form: s³ + a2·s² + a1·s + a0.
  const a2 = totalDamping / mass;
  const a1 = kp / mass;
  const a0 = ki / mass;

  const integralPole = mass > 0 ? realRoot(a2, a1, a0) : 0;

  // Synthetic division by (s − r) leaves s² + B·s + C.
  const b = a2 + integralPole;
  const c = a1 + integralPole * b;

  const omegaN = c > 0 ? Math.sqrt(c) : 0;
  const zeta = omegaN > 0 ? b / (2 * omegaN) : 0;

  const kiCritical = mass > 0 ? (totalDamping * kp) / mass : 0;

  // ki = 0 is unconditionally stable here, so treat the margin as unbounded.
  const stabilityMargin = ki > 0 ? kiCritical / ki : Number.POSITIVE_INFINITY;

  let stability: Stability;
  if (kp <= 0 || totalDamping <= 0) {
    stability = "unstable";
  } else if (stabilityMargin > 1.25) {
    stability = "stable";
  } else if (stabilityMargin >= 1) {
    stability = "marginal";
  } else {
    stability = "unstable";
  }

  let dampingRegime: DampingRegime;
  if (zeta < 0.02) dampingRegime = "undamped";
  else if (zeta < 0.98) dampingRegime = "underdamped";
  else if (zeta <= 1.02) dampingRegime = "critically damped";
  else dampingRegime = "overdamped";

  const predictedOvershoot =
    zeta > 0 && zeta < 1
      ? Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta))
      : 0;

  const predictedSettlingTime =
    zeta > 0 && omegaN > 0 ? 4 / (zeta * omegaN) : Number.POSITIVE_INFINITY;

  const droop = kp > 0 ? load / kp : Number.POSITIVE_INFINITY;

  return {
    omegaN,
    zeta,
    integralPole,
    dampingRegime,
    stability,
    kiCritical,
    stabilityMargin,
    predictedOvershoot,
    predictedSettlingTime,
    droop,
  };
}
