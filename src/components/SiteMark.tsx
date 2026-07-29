/**
 * The ringdown — the same mark cut into the favicon at `src/app/icon.png`.
 *
 * The curve is computed from the system it depicts rather than stored as frozen path
 * data: an underdamped impulse response, y = A·e^(−ku)·sin(2πu/P), sampled once when
 * the module loads. It costs about what a hardcoded path would cost and it stays
 * honest — retune the damping and the drawing follows instead of silently disagreeing
 * with the favicon.
 *
 * Two accents, read the way the rest of the palette reads: amber is the impulse that
 * went in, cyan is what the system did with it.
 */

const Y0 = 262; // settled value — the origin and the tail sit on the same line
const X0 = 80; // ringing starts here, after a short lead-in from the dot
const X_END = 462;
const DOT_X = 58;
const AMP = 151;
const PERIOD = 82;
const DECAY = 0.0115; // zeta ≈ 0.12 — four visible excursions
const CYCLES = 4;

/**
 * Sampling stops on an exact zero crossing (a whole number of half periods), so the
 * curve meets the straight tail at the baseline rather than mid-wobble. 100 steps is
 * ~25 per cycle: smooth well past any size this is drawn at.
 */
const RINGDOWN = (() => {
  const uEnd = CYCLES * PERIOD;
  const steps = 100;
  const points: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * uEnd;
    const y = Y0 - AMP * Math.exp(-DECAY * u) * Math.sin((2 * Math.PI * u) / PERIOD);
    points.push(`${(X0 + u).toFixed(1)} ${y.toFixed(1)}`);
  }

  return `M${DOT_X} ${Y0} L ${points.join(" L ")} L ${X_END} ${Y0}`;
})();

/**
 * Cropped to the drawing's own bounding box rather than the favicon's square canvas —
 * a 2:1 mark letterboxed into a square would render at half the height beside the
 * wordmark and read as a speck.
 */
export function SiteMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="46 134 423 210"
      className={className}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={RINGDOWN}
        fill="none"
        className="stroke-response"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={DOT_X} cy={Y0} r="12" className="fill-command" />
    </svg>
  );
}
