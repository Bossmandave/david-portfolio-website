"use client";

import { LiveValue } from "@/components/ui/LiveValue";
import { analyseLoop } from "@/core/control/analysis";
import { useRuntime } from "@/engine/runtime/RuntimeProvider";
import type { LoopSettings } from "@/modules/control/system";

const STABILITY_TONE = {
  stable: "text-ink-dim",
  marginal: "text-warn",
  unstable: "text-danger",
} as const;

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`flex items-baseline gap-1.5 ${className}`}>
      <span className="tabular text-[10px] tracking-[0.14em] text-ink-faint uppercase">
        {label}
      </span>
      {children}
    </span>
  );
}

export function StatusBar({ settings }: { settings: LoopSettings }) {
  const runtime = useRuntime();
  const analysis = analyseLoop(settings.gains, settings.plant);

  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-3 sm:gap-6 sm:px-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="tabular text-[11px] tracking-[0.22em] text-ink uppercase">
          Control
        </span>
        <span className="tabular hidden text-[11px] text-ink-faint sm:inline">
          spike 001 · pid loop driving the interface
        </span>
      </div>

      <div className="flex shrink-0 items-baseline gap-2.5 sm:gap-4">
        <Field label="ζ">
          <span className="tabular text-[12px] text-ink">
            {analysis.zeta.toFixed(3)}
          </span>
        </Field>

        <Field label="ωₙ">
          <span className="tabular text-[12px] text-ink">
            {analysis.omegaN.toFixed(1)}
          </span>
        </Field>

        <Field label="margin">
          <span
            className={`tabular text-[12px] ${STABILITY_TONE[analysis.stability]}`}
          >
            {Number.isFinite(analysis.stabilityMargin)
              ? `${analysis.stabilityMargin.toFixed(2)}×`
              : "∞"}
          </span>
        </Field>

        <span
          className={`tabular hidden text-[11px] tracking-[0.14em] uppercase md:inline ${STABILITY_TONE[analysis.stability]}`}
          aria-live="polite"
        >
          {analysis.stability}
        </span>

        <span className="hidden h-3.5 w-px bg-line-bright lg:block" />

        <Field label="fps" className="hidden lg:flex">
          <LiveValue
            className="tabular text-[12px] text-ink-dim"
            hz={4}
            get={() => runtime.stats.fps}
            format={(v) => v.toFixed(0)}
          />
        </Field>

        <Field label="p95" className="hidden lg:flex">
          <LiveValue
            className="tabular text-[12px] text-ink-dim"
            hz={4}
            get={() => runtime.stats.percentile(0.95)}
            format={(v) => `${v.toFixed(1)}ms`}
          />
        </Field>
      </div>
    </header>
  );
}
