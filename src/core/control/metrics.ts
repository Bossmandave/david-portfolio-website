export interface StepSample {
  /** Seconds since the step was applied. */
  t: number;
  value: number;
}

export interface StepMetrics {
  /** 10% → 90% of the commanded change, seconds. Null if never reached. */
  riseTime: number | null;
  /** Peak excursion as a fraction of the commanded change. 0.12 = 12% overshoot. */
  overshoot: number;
  /** Time of that peak, seconds. */
  peakTime: number | null;
  /** First time after which the response stays inside the band, seconds. Null if never. */
  settlingTime: number | null;
  /** Residual error at the last sample, in the same units as the signal. */
  steadyStateError: number;
  /** Fraction of the commanded change used for the settling band. */
  settlingBand: number;
  /** True when the response never entered — or left and never re-entered — the band. */
  settled: boolean;
}

const EMPTY: StepMetrics = {
  riseTime: null,
  overshoot: 0,
  peakTime: null,
  settlingTime: null,
  steadyStateError: 0,
  settlingBand: 0.02,
  settled: false,
};

/**
 * Classical step-response analysis, computed from *measured* samples rather than from
 * the model. The point of measuring is that saturation, the derivative filter, and the
 * integral pole all bend the real response away from the second-order prediction — so
 * predicted and measured are allowed to disagree, and the disagreement is informative.
 *
 * @param samples  ordered by time, starting at the moment of the step
 * @param from     value the signal held before the step
 * @param to       commanded value
 * @param band     settling tolerance as a fraction of the commanded change
 */
export function analyseStepResponse(
  samples: readonly StepSample[],
  from: number,
  to: number,
  band = 0.02,
): StepMetrics {
  const delta = to - from;
  if (samples.length < 2 || delta === 0) {
    return { ...EMPTY, settlingBand: band };
  }

  const tolerance = Math.abs(delta) * band;

  // Normalised progress toward the target: 0 at the start, 1 on target. Dividing by the
  // signed delta means a downward step reads identically to an upward one — overshoot is
  // always progress beyond 1, whichever way the signal travelled.
  const progress = (value: number) => (value - from) / delta;

  let tAt10: number | null = null;
  let tAt90: number | null = null;
  let peakProgress = 0;
  let peakTime: number | null = null;

  for (const sample of samples) {
    const q = progress(sample.value);

    if (tAt10 === null && q >= 0.1) tAt10 = sample.t;
    if (tAt90 === null && q >= 0.9) tAt90 = sample.t;

    if (q > peakProgress) {
      peakProgress = q;
      peakTime = sample.t;
    }
  }

  const riseTime = tAt10 !== null && tAt90 !== null ? tAt90 - tAt10 : null;
  const overshoot = Math.max(0, peakProgress - 1);

  // Settling time is the last moment the signal was outside the band — anything earlier
  // does not count, because the definition requires it to *stay* inside afterwards.
  let settlingTime: number | null = null;
  let sawOutside = false;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (Math.abs(samples[i].value - to) > tolerance) {
      sawOutside = true;
      settlingTime = i + 1 < samples.length ? samples[i + 1].t : null;
      break;
    }
  }
  // Never left the band at all: it was already settled when the step landed.
  if (!sawOutside) settlingTime = samples[0].t;

  const last = samples[samples.length - 1];
  const steadyStateError = to - last.value;
  const settled = Math.abs(steadyStateError) <= tolerance && settlingTime !== null;

  return {
    riseTime,
    overshoot,
    peakTime,
    settlingTime,
    steadyStateError,
    settlingBand: band,
    settled,
  };
}
