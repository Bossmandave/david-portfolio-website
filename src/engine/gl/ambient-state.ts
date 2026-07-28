/**
 * How much the ambient field should ring, 0…1.
 *
 * Deliberately not the damping ratio. ζ is not monotonic in any single gain — winding
 * derivative action far up produces a slow, lightly damped pair, so a loop can ring at
 * both ends of the slider and sit calm in the middle. Feeding ζ straight to a shader
 * therefore compresses the interesting range into almost nothing.
 *
 * Peak overshoot is the honest driver: it answers "does this loop ring", which is the
 * question the visuals are actually asking, and it spans the full 0…1 range.
 *
 * A plain mutable singleton, because this is written whenever a gain moves and read
 * every frame — neither party should cause a React render for it.
 */
export const ambientCharacter = {
  ringing: null as number | null,
};

/** Peak overshoot of a second-order response, as a fraction of the step. */
export function ringingFromDamping(zeta: number): number {
  // A non-positive damping ratio means the loop is unstable: maximum ring.
  if (!Number.isFinite(zeta) || zeta <= 0) return 1;
  if (zeta >= 1) return 0;
  return Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta));
}

export function setAmbientRinging(value: number | null): void {
  ambientCharacter.ringing = value === null ? null : Math.min(1, Math.max(0, value));
}

export function resolveAmbientRinging(fallbackZeta: number): number {
  return ambientCharacter.ringing ?? ringingFromDamping(fallbackZeta);
}
