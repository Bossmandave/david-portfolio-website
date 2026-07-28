"use client";

import { useEffect, useRef, useState } from "react";

import { createPointerState } from "@/engine/input/pointer";
import { useRender, useSimulate } from "@/engine/runtime/RuntimeProvider";
import { ControlContext, useControl } from "@/modules/control/context";
import { Instruments } from "@/modules/control/Instruments";
import { Oscilloscope } from "@/modules/control/Oscilloscope";
import { Stage } from "@/modules/control/Stage";
import { StatusBar } from "@/modules/control/StatusBar";
import { TuningPanel } from "@/modules/control/TuningPanel";
import { cloneSettings, DEFAULT_SETTINGS } from "@/modules/control/presets";
import { ControlSystem, type LoopSettings } from "@/modules/control/system";
import { useStepStatus } from "@/modules/control/useStepStatus";

/** Fades out the moment the loop receives its first command. */
function PointerHint() {
  const { pointer } = useControl();
  const ref = useRef<HTMLDivElement>(null);
  const dismissed = useRef(false);

  useRender(() => {
    if (dismissed.current || !pointer.active) return;
    dismissed.current = true;
    if (ref.current) ref.current.style.opacity = "0";
  });

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-700"
    >
      <p className="tabular text-[11px] tracking-[0.22em] text-ink-faint uppercase">
        Move the pointer to command the loop
      </p>
    </div>
  );
}

function Workspace({
  settings,
  onChange,
}: {
  settings: LoopSettings;
  onChange: (next: LoopSettings) => void;
}) {
  const { system } = useControl();
  const { phase } = useStepStatus();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        system.beginStepTest();
      } else if (event.key.toLowerCase() === "r") {
        system.reset();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [system]);

  return (
    // Below `lg` this is a scrolling document; from `lg` up it locks to the viewport
    // and becomes an instrument panel. Forcing the fixed layout onto a phone squeezed
    // the stage, the scope and the controls into a viewport none of them fit in.
    <div className="flex min-h-dvh flex-col bg-void text-ink lg:h-dvh">
      <StatusBar settings={settings} />

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <main className="flex flex-col lg:min-h-0 lg:min-w-0 lg:flex-1">
          <div className="relative h-[320px] shrink-0 lg:h-auto lg:min-h-[320px] lg:flex-1">
            <Stage />
            <PointerHint />
          </div>

          <div className="flex h-[190px] shrink-0 flex-col border-t border-line">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="tabular text-[10px] tracking-[0.22em] text-ink-faint uppercase">
                Scope · vertical axis · 4s
              </span>
              <span className="flex items-center gap-4">
                <span className="tabular flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                  <span className="inline-block h-px w-4 border-t border-dashed border-ink-faint" />
                  commanded
                </span>
                <span className="tabular flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-ink-faint uppercase">
                  <span className="inline-block h-px w-4 bg-signal" />
                  measured
                </span>
              </span>
            </div>
            <div className="min-h-0 flex-1 px-2 pb-2">
              <Oscilloscope />
            </div>
          </div>
        </main>

        <aside className="w-full shrink-0 border-t border-line lg:w-[304px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <TuningPanel
            settings={settings}
            onChange={onChange}
            onStep={() => system.beginStepTest()}
            onReset={() => system.reset()}
            stepBusy={phase !== "idle"}
          />
          <Instruments settings={settings} />
        </aside>
      </div>
    </div>
  );
}

export function ControlSpike() {
  const [settings, setSettings] = useState<LoopSettings>(() =>
    cloneSettings(DEFAULT_SETTINGS),
  );
  const [system] = useState(() => new ControlSystem(DEFAULT_SETTINGS));
  const [pointer] = useState(() => createPointerState());
  const [context] = useState(() => ({ system, pointer }));

  // Settings are cold state: they change when a human moves a slider, not per frame.
  // Pushing them into the running loop here is the entire React↔simulation boundary.
  useEffect(() => {
    system.applySettings(settings);
  }, [system, settings]);

  // The only simulation subscriber on the page. Ordering is explicit rather than
  // emergent: the setpoint is refreshed from the pointer, then the loop closes on it.
  useSimulate((dt) => {
    if (pointer.active) system.setTarget(pointer.x, pointer.y);
    system.simulate(dt);
  });

  return (
    <ControlContext.Provider value={context}>
      <Workspace settings={settings} onChange={setSettings} />
    </ControlContext.Provider>
  );
}
