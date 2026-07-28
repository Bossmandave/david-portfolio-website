"use client";

import { useRef } from "react";

import { LiveValue } from "@/components/ui/LiveValue";
import { analyseLoop } from "@/core/control/analysis";
import { useRender } from "@/engine/runtime/RuntimeProvider";
import { useControl } from "@/modules/control/context";
import type { LoopSettings } from "@/modules/control/system";
import { useStepStatus } from "@/modules/control/useStepStatus";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="tabular text-[11px] tracking-[0.14em] text-ink-faint uppercase">
        {label}
      </span>
      <span className="tabular text-[12px] text-ink">{children}</span>
    </div>
  );
}

/** Lights while the controller is asking for more effort than the actuator can deliver. */
function SaturationLamp() {
  const { system } = useControl();
  const ref = useRef<HTMLSpanElement>(null);
  const wasLit = useRef(false);

  useRender(() => {
    const lit =
      system.pidY.telemetry.saturated || system.pidX.telemetry.saturated;
    if (lit === wasLit.current) return;
    wasLit.current = lit;

    const node = ref.current;
    if (!node) return;
    node.textContent = lit ? "SATURATED" : "nominal";
    node.className = `tabular text-[12px] ${lit ? "text-warn" : "text-ink-faint"}`;
  });

  return <span ref={ref} className="tabular text-[12px] text-ink-faint" />;
}

const ms = (seconds: number | null) =>
  seconds === null || !Number.isFinite(seconds)
    ? "—"
    : `${(seconds * 1000).toFixed(0)} ms`;

const percent = (fraction: number) => `${(fraction * 100).toFixed(1)} %`;

export function Instruments({ settings }: { settings: LoopSettings }) {
  const { system } = useControl();
  const { metrics, phase, diverged } = useStepStatus();
  const analysis = analyseLoop(settings.gains, settings.plant);

  const predictedSteadyState = settings.gains.ki > 0 ? 0 : analysis.droop;

  return (
    <div>
      <section className="border-b border-line px-4 py-4">
        <h2 className="tabular mb-3.5 text-[10px] tracking-[0.22em] text-ink-faint uppercase">
          Live
        </h2>
        <div className="space-y-2">
          <Row label="e">
            <LiveValue
              get={() => system.pidY.telemetry.error}
              format={(v) => `${v.toFixed(1)} px`}
            />
          </Row>
          <Row label="u">
            <LiveValue
              get={() => system.pidY.telemetry.output}
              format={(v) => v.toFixed(0)}
            />
          </Row>
          <Row label="∫ term">
            <LiveValue
              get={() => system.pidY.telemetry.i}
              format={(v) => v.toFixed(0)}
            />
          </Row>
          <Row label="actuator">
            <SaturationLamp />
          </Row>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-ink-faint">
          Watch <span className="tabular text-ink-dim">∫ term</span> climb until it
          equals the load. That is integral action doing the one thing only it can do.
        </p>
      </section>

      <section className="px-4 py-4">
        <h2 className="tabular mb-3.5 text-[10px] tracking-[0.22em] text-ink-faint uppercase">
          Step response
        </h2>

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2">
          <span />
          <span className="tabular text-right text-[10px] tracking-[0.14em] text-ink-faint uppercase">
            Theory
          </span>
          <span className="tabular text-right text-[10px] tracking-[0.14em] text-signal uppercase">
            Measured
          </span>

          <span className="tabular text-[11px] tracking-[0.14em] text-ink-faint uppercase">
            Overshoot
          </span>
          <span className="tabular text-right text-[12px] text-ink-dim">
            {percent(analysis.predictedOvershoot)}
          </span>
          <span className="tabular text-right text-[12px] text-ink">
            {metrics ? percent(metrics.overshoot) : "—"}
          </span>

          <span className="tabular text-[11px] tracking-[0.14em] text-ink-faint uppercase">
            Settling
          </span>
          <span className="tabular text-right text-[12px] text-ink-dim">
            {ms(analysis.predictedSettlingTime)}
          </span>
          <span className="tabular text-right text-[12px] text-ink">
            {metrics ? ms(metrics.settlingTime) : "—"}
          </span>

          <span className="tabular text-[11px] tracking-[0.14em] text-ink-faint uppercase">
            Rise
          </span>
          <span className="tabular text-right text-[12px] text-ink-faint">—</span>
          <span className="tabular text-right text-[12px] text-ink">
            {metrics ? ms(metrics.riseTime) : "—"}
          </span>

          <span className="tabular text-[11px] tracking-[0.14em] text-ink-faint uppercase">
            SS error
          </span>
          <span className="tabular text-right text-[12px] text-ink-dim">
            {predictedSteadyState.toFixed(1)} px
          </span>
          <span className="tabular text-right text-[12px] text-ink">
            {metrics ? `${metrics.steadyStateError.toFixed(1)} px` : "—"}
          </span>
        </div>

        <p
          className="mt-3 min-h-[3.6em] text-[11px] leading-snug text-ink-faint"
          aria-live="polite"
        >
          {diverged
            ? "The loop diverged. Effort and error are feeding each other — no measurement is meaningful past that point."
            : phase === "arming"
              ? "Settling at the start position before the step lands…"
              : phase === "capturing"
                ? "Capturing the response…"
                : metrics
                  ? "Theory assumes a linear second-order loop. Measured includes saturation, the derivative filter and the integral pole — the gap between the columns is everything the model leaves out."
                  : "Run a step test to measure the real response of the object above."}
        </p>
      </section>
    </div>
  );
}
