export interface MotionToken {
  zeta: number;
  omegaN: number;
}

/**
 * The motion system.
 *
 * There are no durations here and no cubic-bezier curves. Every transition on the site
 * is a real second-order response solved at runtime, so duration is an *output* of the
 * tuning rather than a number picked by eye. The names describe what the motion feels
 * like; the numbers are what produce it.
 */
export const MOTION = {
  /** ζ = 1. Fastest arrival with no overshoot. Toggles, tabs, state changes. */
  settle: { zeta: 1.0, omegaN: 22 },
  /** A trace of overshoot reads as confidence. Buttons, confirmations. */
  commit: { zeta: 0.78, omegaN: 18 },
  /** Entrances and reveals. The hero lands on this one. */
  arrive: { zeta: 0.62, omegaN: 14 },
  /** Loose and slow. Camera, ambient depth, background parallax. */
  drift: { zeta: 0.45, omegaN: 6 },
  /** Rings visibly. Errors only. */
  alert: { zeta: 0.3, omegaN: 26 },
} as const satisfies Record<string, MotionToken>;

export type MotionTokenName = keyof typeof MOTION;

/**
 * Reduced motion is a retune, not a stripped build.
 *
 * The loop still runs and still settles — it is simply critically damped, so nothing
 * ever overshoots, and stiffer, so it gets there sooner. Accessibility expressed as a
 * tuning decision rather than as an exception path with its own bugs.
 */
export function criticallyDamped(token: MotionToken): MotionToken {
  return { zeta: 1, omegaN: token.omegaN * 1.5 };
}

export function resolveMotion(
  token: MotionToken,
  prefersReducedMotion: boolean,
): MotionToken {
  return prefersReducedMotion ? criticallyDamped(token) : token;
}
