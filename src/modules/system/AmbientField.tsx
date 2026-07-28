"use client";

import { useCallback, useEffect, useRef } from "react";

import { SecondOrder } from "@/core/control/second-order";
import { MOTION, resolveMotion } from "@/design/motion";
import { createVarWriter, type VarWriter } from "@/engine/channel/css-vars";
import { FieldCanvas } from "@/engine/gl/FieldCanvas";
import { resolveAmbientRinging } from "@/engine/gl/ambient-state";
import { useRender, useSimulate } from "@/engine/runtime/RuntimeProvider";
import { useReducedMotion } from "@/engine/runtime/useReducedMotion";

/**
 * The ambient loop.
 *
 * The pointer, normalised to −1…1 across the viewport, is the setpoint. Two second-order
 * systems tuned to `drift` chase it and publish their output as CSS custom properties on
 * the document root. Nothing subscribes in JavaScript — every parallax layer on the page
 * reads `--sys-x` and `--sys-y` in CSS, so depth costs no re-renders and no per-element
 * listeners.
 *
 * There is no integral term here on purpose: this loop has no load, so `ki` would have
 * nothing to cancel and would only contribute windup when the pointer leaves the window.
 */
export function AmbientField() {
  const reducedMotion = useReducedMotion();
  const axesRef = useRef({
    x: new SecondOrder(MOTION.drift.zeta, MOTION.drift.omegaN),
    y: new SecondOrder(MOTION.drift.zeta, MOTION.drift.omegaN),
  });
  const writerRef = useRef<VarWriter | null>(null);
  const elapsed = useRef(0);

  useEffect(() => {
    const axes = axesRef.current;
    writerRef.current = createVarWriter(document.documentElement);

    const onPointerMove = (event: PointerEvent) => {
      axes.x.target = (event.clientX / window.innerWidth) * 2 - 1;
      axes.y.target = (event.clientY / window.innerHeight) * 2 - 1;
    };

    // Returning to centre when the pointer leaves is the loop rejecting a step back to
    // zero — the same behaviour, not a special case.
    const onPointerLeave = () => {
      axes.x.target = 0;
      axes.y.target = 0;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  useEffect(() => {
    const token = resolveMotion(MOTION.drift, reducedMotion);
    const axes = axesRef.current;
    for (const axis of [axes.x, axes.y]) {
      axis.zeta = token.zeta;
      axis.omegaN = token.omegaN;
    }
  }, [reducedMotion]);

  useSimulate((dt) => {
    elapsed.current += dt;
    const axes = axesRef.current;
    axes.x.step(dt);
    axes.y.step(dt);
  });

  useRender(() => {
    const write = writerRef.current;
    if (!write) return;

    const axes = axesRef.current;
    write("--sys-x", axes.x.value.toFixed(4));
    write("--sys-y", axes.y.value.toFixed(4));

    const energy = Math.min(1, Math.hypot(axes.x.velocity, axes.y.velocity) / 4);
    write("--sys-energy", energy.toFixed(3));
  });

  // Stable across renders, so the canvas never resubscribes; it reads the loop's
  // live state each frame rather than being handed a snapshot through props.
  const getFieldState = useCallback(() => {
    const axes = axesRef.current;
    return {
      time: elapsed.current,
      pointerX: axes.x.value,
      pointerY: axes.y.value,
      energy: Math.min(1, Math.hypot(axes.x.velocity, axes.y.velocity) / 3),
      // Whatever loop the visitor is currently tuning, if any — otherwise this page's
      // own drift tuning.
      ringing: resolveAmbientRinging(axes.x.zeta),
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Beneath everything, and entirely optional: at tier 0 it renders nothing and
          the CSS layers below carry the whole ambience on their own. */}
      <FieldCanvas getState={getFieldState} />
      {/* Graticule. Translated by the loop, so the ground itself is under control. */}
      <div
        className="absolute -inset-32"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
          backgroundSize: "88px 88px",
          opacity: 0.4,
          maskImage:
            "radial-gradient(ellipse 80% 55% at 50% 40%, #000 0%, transparent 75%)",
          transform:
            "translate3d(calc(var(--sys-x) * -18px), calc(var(--sys-y) * -18px), 0)",
        }}
      />

      {/* Volumetric wash. Brightens with loop energy, so fast movement lights the room. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at calc(50% + var(--sys-x) * 12%) calc(42% + var(--sys-y) * 12%), color-mix(in srgb, var(--color-response) 9%, transparent), transparent 70%)",
          opacity: "calc(0.55 + var(--sys-energy) * 0.45)",
        }}
      />
    </div>
  );
}
