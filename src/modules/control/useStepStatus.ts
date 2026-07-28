"use client";

import { useRef, useState } from "react";

import type { StepMetrics } from "@/core/control/metrics";
import { useRender } from "@/engine/runtime/RuntimeProvider";
import { useControl } from "@/modules/control/context";
import type { StepPhase } from "@/modules/control/system";

interface StepStatus {
  phase: StepPhase;
  metrics: StepMetrics | null;
  diverged: boolean;
}

/**
 * Bridges the simulation's step-test state into React.
 *
 * Polled at 5Hz rather than pushed, and gated on a revision counter so a render only
 * happens when something actually changed. These are the handful of values that *should*
 * live in React state — they change on user action, not per frame — and keeping the
 * boundary this narrow is what keeps the rest of the page render-free.
 */
export function useStepStatus(): StepStatus {
  const { system } = useControl();
  const [status, setStatus] = useState<StepStatus & { revision: number }>({
    phase: "idle",
    metrics: null,
    diverged: false,
    revision: 0,
  });

  const elapsed = useRef(0);

  useRender(({ frameMs }) => {
    elapsed.current += frameMs;
    if (elapsed.current < 200) return;
    elapsed.current = 0;

    if (
      system.stepPhase !== status.phase ||
      system.metricsRevision !== status.revision ||
      system.diverged !== status.diverged
    ) {
      setStatus({
        phase: system.stepPhase,
        metrics: system.metrics,
        diverged: system.diverged,
        revision: system.metricsRevision,
      });
    }
  });

  return status;
}
