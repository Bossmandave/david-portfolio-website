import type { StepMetrics } from "@/core/control/metrics";

/**
 * The tuning target.
 *
 * Three conditions, and each one requires a different term. Settling time cannot be
 * reached without raising kp; overshoot cannot be held down without raising kd to match;
 * and the residual offset cannot be cleared without ki. Satisfying any two while
 * ignoring the third is the trap, which is what makes it a control problem rather than
 * a slider puzzle.
 */
export const CHALLENGE = {
  settlingSeconds: 0.3,
  overshoot: 0.05,
  /** Pixels. The load pulls the subject off target until integral action cancels it. */
  steadyStateError: 3,
} as const;

export interface ChallengeCondition {
  id: "settling" | "overshoot" | "offset";
  label: string;
  target: string;
  actual: string;
  met: boolean;
}

export interface ChallengeResult {
  attempted: boolean;
  passed: boolean;
  conditions: ChallengeCondition[];
}

const IDLE: ChallengeResult = {
  attempted: false,
  passed: false,
  conditions: [
    {
      id: "settling",
      label: "Settles within",
      target: "300 ms",
      actual: "—",
      met: false,
    },
    {
      id: "overshoot",
      label: "Overshoot under",
      target: "5 %",
      actual: "—",
      met: false,
    },
    {
      id: "offset",
      label: "Final offset under",
      target: "3 px",
      actual: "—",
      met: false,
    },
  ],
};

export function evaluateChallenge(
  metrics: StepMetrics | null,
): ChallengeResult {
  if (!metrics) return IDLE;

  const settled =
    metrics.settlingTime !== null &&
    metrics.settlingTime <= CHALLENGE.settlingSeconds;
  const damped = metrics.overshoot <= CHALLENGE.overshoot;
  const onTarget =
    Math.abs(metrics.steadyStateError) <= CHALLENGE.steadyStateError;

  const conditions: ChallengeCondition[] = [
    {
      id: "settling",
      label: "Settles within",
      target: "300 ms",
      actual:
        metrics.settlingTime === null
          ? "never"
          : `${Math.round(metrics.settlingTime * 1000)} ms`,
      met: settled,
    },
    {
      id: "overshoot",
      label: "Overshoot under",
      target: "5 %",
      actual: `${(metrics.overshoot * 100).toFixed(1)} %`,
      met: damped,
    },
    {
      id: "offset",
      label: "Final offset under",
      target: "3 px",
      actual: `${Math.abs(metrics.steadyStateError).toFixed(1)} px`,
      met: onTarget,
    },
  ];

  return {
    attempted: true,
    passed: settled && damped && onTarget,
    conditions,
  };
}
