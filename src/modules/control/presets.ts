import { DEFAULT_PID_OPTIONS } from "@/core/control/pid";
import type { LoopSettings } from "@/modules/control/system";

export const DEFAULT_SETTINGS: LoopSettings = {
  gains: { kp: 200, ki: 700, kd: 20 },
  plant: { mass: 1, damping: 0.5, load: 6000 },
  options: { ...DEFAULT_PID_OPTIONS, outputLimit: 100_000 },
};

/** Deep copy, so live edits never mutate the shared defaults. */
export function cloneSettings(settings: LoopSettings): LoopSettings {
  return {
    gains: { ...settings.gains },
    plant: { ...settings.plant },
    options: { ...settings.options },
  };
}

export interface Preset {
  id: string;
  label: string;
  /** What this tuning is meant to demonstrate. */
  note: string;
  gains: LoopSettings["gains"];
}

/**
 * Each preset isolates one lesson. Together they walk the whole argument: what each term
 * contributes, what its absence costs, and where the loop stops being stable at all.
 */
export const PRESETS: Preset[] = [
  {
    id: "critical",
    label: "Critical",
    note: "ζ = 1. The fastest response that never overshoots. Surgical, slightly cold.",
    gains: { kp: 200, ki: 700, kd: 27.8 },
  },
  {
    id: "snappy",
    label: "Snappy",
    note: "ζ ≈ 0.6. A little overshoot reads as confidence. This is what good UI motion is.",
    gains: { kp: 200, ki: 700, kd: 16.5 },
  },
  {
    id: "ringing",
    label: "Ringing",
    note: "ζ ≈ 0.15. Barely any damping left. It hunts for the target and keeps missing.",
    gains: { kp: 200, ki: 400, kd: 3.7 },
  },
  {
    id: "droop",
    label: "No integral",
    note: "ki = 0. Nothing cancels the load, so it settles below the cursor and stays there.",
    gains: { kp: 200, ki: 0, kd: 20 },
  },
  {
    id: "unstable",
    label: "Unstable",
    note: "ki past the Routh–Hurwitz limit. The loop pumps energy in faster than it removes it.",
    gains: { kp: 200, ki: 3000, kd: 2 },
  },
];
