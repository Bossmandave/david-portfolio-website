"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { FieldRenderer, type FieldState } from "@/engine/gl/field";
import { useRender, useRuntime } from "@/engine/runtime/RuntimeProvider";
import {
  demoteTier,
  getServerTier,
  getTier,
  subscribeToTier,
} from "@/engine/runtime/tier";

/** Frame time above which this device is judged unable to hold the effect. */
const BUDGET_MS = 22;
/** Seconds of sustained overrun before stepping down. */
const PATIENCE = 2.5;

export function FieldCanvas({ getState }: { getState: () => FieldState }) {
  const tier = useSyncExternalStore(subscribeToTier, getTier, getServerTier);
  const runtime = useRuntime();

  // Nothing GPU-related is created until the page has had a chance to paint. The
  // field is ambience; it must never be on the critical path to first contentful
  // paint, and shader compilation is the one part of this that blocks a thread.
  const [ready, setReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FieldRenderer | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const overrun = useRef(0);

  useEffect(() => {
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => setReady(true), { timeout: 1200 })
      : window.setTimeout(() => setReady(true), 600);

    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, []);

  useEffect(() => {
    if (!ready || tier === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = FieldRenderer.create(canvas, tier);

    if (process.env.NODE_ENV === "development") {
      // Silent failure is correct for visitors and useless while building. This is
      // the only way to tell "the effect is subtle" apart from "the effect is off".
      console.info(
        `[field] tier ${tier} · ${renderer ? "webgl2 active" : "no context — CSS fallback"}`,
      );
    }

    // Creation returns null on a blocked context or a driver that rejects the
    // shader. Both are ordinary on real machines, and both simply mean the CSS
    // field underneath stays visible on its own.
    if (!renderer) return;
    rendererRef.current = renderer;

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { width: rect.width, height: rect.height, dpr };
      renderer.resize(rect.width, rect.height, dpr);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);

    // A lost context throws away every GL object silently. Marking it dead stops the
    // loop drawing into nothing; preventDefault is what allows a restore at all.
    const onLost = (event: Event) => {
      event.preventDefault();
      renderer.lost = true;
    };

    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [ready, tier]);

  useRender(({ frameMs }) => {
    const renderer = rendererRef.current;
    if (!renderer || renderer.lost) return;

    renderer.render(getState());

    // A promise kept by measurement rather than by guessing at load: a machine that
    // copes at rest can still fall over once it is warm.
    if (runtime.stats.length < 120) return;
    if (runtime.stats.percentile(0.95) > BUDGET_MS) {
      overrun.current += frameMs / 1000;
      if (overrun.current > PATIENCE) {
        overrun.current = 0;
        demoteTier();
      }
    } else {
      overrun.current = Math.max(0, overrun.current - frameMs / 1000);
    }
  });

  if (tier === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ opacity: ready ? 1 : 0, transition: "opacity 900ms ease-out" }}
    />
  );
}
