"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { GainSlider } from "@/components/ui/GainSlider";
import { Toggle } from "@/components/ui/Toggle";
import { PRESETS } from "@/modules/control/presets";
import type { LoopSettings } from "@/modules/control/system";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4">
      <h2 className="tabular mb-3.5 text-[10px] tracking-[0.22em] text-ink-faint uppercase">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function TuningPanel({
  settings,
  onChange,
  onStep,
  onReset,
  stepBusy,
}: {
  settings: LoopSettings;
  onChange: (next: LoopSettings) => void;
  onStep: () => void;
  onReset: () => void;
  stepBusy: boolean;
}) {
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const note = PRESETS.find((preset) => preset.id === activePreset)?.note;

  const setGain = (key: keyof LoopSettings["gains"], value: number) => {
    setActivePreset(null);
    onChange({ ...settings, gains: { ...settings.gains, [key]: value } });
  };

  const setPlant = (key: keyof LoopSettings["plant"], value: number) => {
    onChange({ ...settings, plant: { ...settings.plant, [key]: value } });
  };

  return (
    <div>
      <Section title="Controller">
        <GainSlider
          label="Kp"
          symbol="proportional"
          hint="Acts on present error. Raises speed and overshoot together."
          value={settings.gains.kp}
          min={10}
          max={800}
          step={5}
          onChange={(v) => setGain("kp", v)}
          format={(v) => v.toFixed(0)}
        />
        <GainSlider
          label="Ki"
          symbol="integral"
          hint="Acts on accumulated error. The only term that can cancel the load."
          value={settings.gains.ki}
          min={0}
          max={6000}
          step={25}
          onChange={(v) => setGain("ki", v)}
          format={(v) => v.toFixed(0)}
        />
        <GainSlider
          label="Kd"
          symbol="derivative"
          hint="Acts on rate of change. The only term that damps. Take it to zero."
          value={settings.gains.kd}
          min={0}
          max={60}
          step={0.5}
          onChange={(v) => setGain("kd", v)}
          format={(v) => v.toFixed(1)}
        />
      </Section>

      <Section title="Plant">
        <GainSlider
          label="Load"
          symbol="disturbance"
          hint="Constant downward force. Without it, integral action would have no job."
          value={settings.plant.load}
          min={0}
          max={20000}
          step={250}
          onChange={(v) => setPlant("load", v)}
          format={(v) => v.toFixed(0)}
        />
        <GainSlider
          label="Mass"
          symbol="inertia"
          hint="Resists acceleration. Heavier lowers ωₙ and slows the whole loop down."
          value={settings.plant.mass}
          min={0.4}
          max={4}
          step={0.1}
          onChange={(v) => setPlant("mass", v)}
          format={(v) => v.toFixed(1)}
        />
      </Section>

      <Section title="Implementation">
        <Toggle
          label="Anti-windup"
          hint="Bleeds the integrator while the actuator is saturated. Switch off, then flick the pointer across the stage and back."
          checked={settings.options.antiWindup}
          onChange={(checked) =>
            onChange({
              ...settings,
              options: { ...settings.options, antiWindup: checked },
            })
          }
        />
        <Toggle
          label="D on measurement"
          hint="Differentiates the measurement rather than the error. Switch off and run a step test to see the derivative kick."
          checked={settings.options.derivativeSource === "measurement"}
          onChange={(checked) =>
            onChange({
              ...settings,
              options: {
                ...settings.options,
                derivativeSource: checked ? "measurement" : "error",
              },
            })
          }
        />
      </Section>

      <Section title="Presets">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant="chip"
              aria-pressed={activePreset === preset.id}
              className={
                activePreset === preset.id
                  ? "border-signal/60 text-signal"
                  : undefined
              }
              onClick={() => {
                setActivePreset(preset.id);
                onChange({ ...settings, gains: { ...preset.gains } });
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <p
          className="min-h-[2.4em] text-[11px] leading-snug text-ink-faint"
          aria-live="polite"
        >
          {note ?? "Each preset isolates one behaviour of the loop."}
        </p>
      </Section>

      <div className="flex gap-1.5 px-4 py-4">
        <Button variant="primary" onClick={onStep} disabled={stepBusy}>
          {stepBusy ? "Running…" : "Step test"}
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Reset
        </Button>
      </div>
    </div>
  );
}
