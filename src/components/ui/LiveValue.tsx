"use client";

import { useRef } from "react";

import { useRender } from "@/engine/runtime/RuntimeProvider";

/**
 * A number that updates from the simulation without re-rendering React.
 *
 * The loop produces new values 240 times a second. Routing those through `useState`
 * would re-render this component — and everything above it — at frame rate, for text
 * nobody can read that fast. Instead the value is written straight to `textContent` at a
 * legible cadence, so the whole instrument panel costs zero renders while it runs.
 */
export function LiveValue({
  get,
  format,
  hz = 10,
  className,
}: {
  get: () => number;
  format: (value: number) => string;
  /** Readout refresh rate. Fast enough to feel live, slow enough to read. */
  hz?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const elapsed = useRef(0);
  const interval = 1000 / hz;

  useRender(({ frameMs }) => {
    elapsed.current += frameMs;
    if (elapsed.current < interval) return;
    elapsed.current = 0;

    const node = ref.current;
    if (!node) return;

    const next = format(get());
    if (node.textContent !== next) node.textContent = next;
  });

  return <span ref={ref} className={className} />;
}
