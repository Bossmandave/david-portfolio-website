"use client";

import { createContext, useContext } from "react";

import type { PointerState } from "@/engine/input/pointer";
import type { ControlSystem } from "@/modules/control/system";

export interface ControlContextValue {
  system: ControlSystem;
  pointer: PointerState;
}

export const ControlContext = createContext<ControlContextValue | null>(null);

export function useControl(): ControlContextValue {
  const value = useContext(ControlContext);
  if (!value) {
    throw new Error("useControl must be used inside <ControlSpike>");
  }
  return value;
}
