"use client";

import { useRef } from "react";

import { PATH_STAGES } from "@/content/path";
import { useRender } from "@/engine/runtime/RuntimeProvider";
import { useReducedMotion } from "@/engine/runtime/useReducedMotion";

/** Seconds for one pulse to traverse a single connector. */
const TRAVERSAL = 2.2;
/** Phase offset between consecutive connectors, so the signal propagates rather than blinks. */
const STAGGER = 0.26;

export function PathDiagram({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const pulseRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const phase = useRef(0);

  useRender(({ frameMs }) => {
    if (reducedMotion) return;

    phase.current = (phase.current + frameMs / 1000 / TRAVERSAL) % 1;

    for (let i = 0; i < pulseRefs.current.length; i++) {
      const node = pulseRefs.current[i];
      if (!node) continue;

      const local = (phase.current - i * STAGGER + 1) % 1;
      node.style.setProperty("--pulse", local.toFixed(4));
      // Fading at both ends stops the pulse from popping into existence at the
      // start of each connector and vanishing at the end.
      node.style.setProperty(
        "--pulse-opacity",
        Math.sin(Math.PI * local).toFixed(3),
      );
    }
  });

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = PATH_STAGES.length - 1;
    let next: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;

    if (next === null) return;
    event.preventDefault();
    onSelect(PATH_STAGES[next].id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Career stages"
      aria-orientation="horizontal"
      className="flex flex-col items-stretch md:flex-row md:items-center"
    >
      {PATH_STAGES.map((stage, index) => {
        const active = stage.id === selected;

        return (
          <div key={stage.id} className="contents">
            <button
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              role="tab"
              id={`stage-tab-${stage.id}`}
              aria-selected={active}
              aria-controls="stage-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(stage.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`group relative flex-1 border px-4 py-4 text-left transition-colors focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response ${
                active
                  ? "border-response/60 bg-response/6"
                  : "border-line bg-panel hover:border-line-bright"
              }`}
            >
              <span
                className={`block font-mono text-[9px] tracking-[0.24em] uppercase transition-colors ${
                  active ? "text-response" : "text-ink-faint"
                }`}
              >
                {stage.block}
              </span>
              <span className="mt-1.5 block font-mono text-[0.9375rem] leading-tight tracking-[-0.01em] text-ink">
                {stage.title}
              </span>
              <span className="mt-1 block font-mono text-[10px] tracking-[0.1em] text-ink-faint tabular-nums">
                {stage.span}
              </span>
            </button>

            {index < PATH_STAGES.length - 1 ? (
              <span
                aria-hidden
                className="relative mx-auto h-8 w-px shrink-0 bg-line-bright md:mx-0 md:h-px md:w-10 lg:w-16"
              >
                <span
                  ref={(node) => {
                    pulseRefs.current[index] = node;
                  }}
                  className="signal-pulse"
                />
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
