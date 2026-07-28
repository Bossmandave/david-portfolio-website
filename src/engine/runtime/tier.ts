/**
 * How much visual work this device should be asked to do.
 *
 * 0 — no GPU path at all. CSS only. The site is complete at this tier; nothing here
 *     is load-bearing, which is the point of having it.
 * 1 — GPU, but assume a phone: half-resolution buffer and the cheap shader.
 * 2 — desktop with headroom. Full effect.
 */
export type Tier = 0 | 1 | 2;

export interface DeviceCapabilities {
  webgl2: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  coarsePointer: boolean;
  /** navigator.deviceMemory in GB. Undefined on browsers that withhold it. */
  memoryGb?: number;
  cores?: number;
}

/**
 * Pure, so the policy can be tested without a browser.
 *
 * The ordering is deliberate: preferences beat capabilities. Someone who asked for
 * reduced motion or is on a metered connection gets tier 0 even on a workstation,
 * because that is a request, not a limitation to work around.
 */
export function decideTier(caps: DeviceCapabilities): Tier {
  if (caps.reducedMotion || caps.saveData || !caps.webgl2) return 0;

  // Withheld values are treated as adequate rather than as failures — Safari reports
  // neither, and penalising every Apple device for a privacy decision is wrong.
  const memory = caps.memoryGb ?? 8;
  const cores = caps.cores ?? 8;

  if (memory < 4 || cores < 4) return 1;
  if (caps.coarsePointer) return 1;

  return 2;
}

function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
  } catch {
    return false;
  }
}

export function readCapabilities(): DeviceCapabilities {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  return {
    webgl2: supportsWebGL2(),
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: Boolean(connection?.saveData),
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    memoryGb,
    cores: navigator.hardwareConcurrency,
  };
}

/* --------------------------------------------------------------------------------
 * Store
 *
 * An external store rather than React state, so the server always renders tier 0 and
 * the client corrects on hydration without a mismatch — and so the frame loop can
 * demote the device without going through a component.
 * ------------------------------------------------------------------------------ */

let current: Tier | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getTier(): Tier {
  if (current === null) current = decideTier(readCapabilities());
  return current;
}

export function getServerTier(): Tier {
  return 0;
}

export function subscribeToTier(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Steps the device down one tier. Called by the frame loop when the measured budget
 * says this machine cannot hold the effect — a promise kept at runtime rather than
 * guessed at load, because a device that copes at rest can still cook under load.
 */
export function demoteTier(): void {
  if (current === null) current = getTier();
  if (current === 0) return;
  current = (current - 1) as Tier;
  emit();
}

/** Test seam. */
export function resetTier(value: Tier | null = null): void {
  current = value;
  emit();
}
