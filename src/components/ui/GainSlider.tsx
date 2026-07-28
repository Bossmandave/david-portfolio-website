"use client";

import { useId } from "react";

export function GainSlider({
  label,
  hint,
  symbol,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(1),
}: {
  label: string;
  hint: string;
  symbol?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="group">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="tabular cursor-ew-resize text-[11px] tracking-[0.14em] text-ink-dim uppercase transition-colors group-hover:text-ink"
        >
          {label}
        </label>
        <span className="tabular text-[12px] text-ink">{format(value)}</span>
      </div>

      <input
        id={id}
        type="range"
        className="gain-slider mt-1"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-describedby={hintId}
        onChange={(event) => onChange(Number(event.target.value))}
      />

      <p
        id={hintId}
        className="mt-0.5 text-[11px] leading-snug text-ink-faint"
      >
        {symbol ? <span className="text-ink-dim">{symbol} — </span> : null}
        {hint}
      </p>
    </div>
  );
}
