"use client";

import { memo, useEffect, useRef } from "react";

import { useRender } from "@/engine/runtime/RuntimeProvider";
import { trackPointer } from "@/engine/input/pointer";
import { useControl } from "@/modules/control/context";

const TAU = Math.PI * 2;

/** Velocity at which stretch saturates, px/s. Tuned by eye against the default gains. */
const STRETCH_REFERENCE = 4200;
/** Control effort at which the glow saturates, matching the default output limit. */
const EFFORT_REFERENCE = 100_000;

export const Stage = memo(function Stage() {
  const { system, pointer } = useControl();

  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const wasDiverged = useRef(false);

  // Resolved once on resize rather than looked up per frame — both are cheap on their
  // own and both are pure waste 240 times a second.
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    contextRef.current = context;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      // Capping DPR at 2 costs nothing visible and halves the fill cost on the 3× phone
      // displays where the frame budget is tightest.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width: rect.width, height: rect.height };

      const firstMeasure = system.bounds.width === 0;
      system.setBounds(rect.width, rect.height);
      if (firstMeasure) system.reset();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const detach = trackPointer(host, pointer);

    return () => {
      observer.disconnect();
      detach();
    };
  }, [system, pointer]);

  useRender(() => {
    const context = contextRef.current;
    const object = objectRef.current;
    const glow = glowRef.current;
    const target = targetRef.current;
    const error = errorRef.current;
    const host = hostRef.current;
    if (!context || !object || !glow || !target || !error || !host) return;

    const x = system.plantX.position;
    const y = system.plantY.position;
    const setX = system.setpoint.x;
    const setY = system.setpoint.y;

    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    // --- the controlled object -------------------------------------------------
    // Stretch along the direction of travel. This is not decoration: it is a direct
    // readout of plant velocity, so the eye reads acceleration and braking without
    // needing the scope.
    const vx = system.plantX.velocity;
    const vy = system.plantY.velocity;
    const speed = Math.hypot(vx, vy);
    const angle = Math.atan2(vy, vx);
    const stretch = Math.min(0.5, speed / STRETCH_REFERENCE);

    object.style.transform =
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) ` +
      `rotate(${angle.toFixed(4)}rad) ` +
      `scale(${(1 + stretch).toFixed(3)}, ${(1 - stretch * 0.62).toFixed(3)})`;

    // --- effort ----------------------------------------------------------------
    // Glow tracks how hard the controller is pushing. Animating opacity and transform
    // on a pre-rendered gradient keeps this on the compositor; recomputing a box-shadow
    // every frame would force a paint instead.
    const effort = Math.hypot(
      system.pidX.telemetry.output,
      system.pidY.telemetry.output,
    );
    const load = Math.min(1, effort / EFFORT_REFERENCE);
    glow.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${(0.6 + load * 1.5).toFixed(3)})`;
    glow.style.opacity = (0.12 + load * 0.6).toFixed(3);

    // --- setpoint and error ----------------------------------------------------
    target.style.transform = `translate3d(${setX.toFixed(2)}px, ${setY.toFixed(2)}px, 0)`;

    const dx = x - setX;
    const dy = y - setY;
    const distance = Math.hypot(dx, dy);
    error.style.transform =
      `translate3d(${setX.toFixed(2)}px, ${setY.toFixed(2)}px, 0) ` +
      `rotate(${Math.atan2(dy, dx).toFixed(4)}rad) ` +
      `scaleX(${distance.toFixed(2)})`;
    error.style.opacity = Math.min(0.55, distance / 90).toFixed(3);

    // --- trail -----------------------------------------------------------------
    // Painting a translucent wash over the previous frame decays old positions into a
    // comet tail. Overshoot leaves a visible hook past the target; a settled loop leaves
    // almost nothing.
    const { width, height } = sizeRef.current;

    context.fillStyle = "rgba(6, 6, 9, 0.085)";
    context.fillRect(0, 0, width, height);

    context.beginPath();
    context.arc(x, y, 2.4, 0, TAU);
    context.fillStyle = system.diverged
      ? "rgba(255, 95, 86, 0.55)"
      : "rgba(126, 231, 255, 0.42)";
    context.fill();

    // --- divergence ------------------------------------------------------------
    if (system.diverged !== wasDiverged.current) {
      wasDiverged.current = system.diverged;
      host.dataset.diverged = String(system.diverged);
    }
  });

  return (
    <div
      ref={hostRef}
      data-diverged="false"
      className="group/stage relative h-full w-full cursor-crosshair overflow-hidden [--stage-accent:var(--color-signal)] data-[diverged=true]:[--stage-accent:var(--color-danger)]"
      aria-label="Control loop stage. Move the pointer to command the setpoint; the tracked object is the plant output."
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Error vector: setpoint to plant output. Length is |e| at 1px per pixel. */}
      <div
        ref={errorRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 h-px w-px origin-left bg-(--stage-accent) will-change-transform"
      />

      <div
        ref={glowRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -mt-[110px] -ml-[110px] h-[220px] w-[220px] rounded-full will-change-[transform,opacity]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--stage-accent) 42%, transparent) 0%, transparent 68%)",
        }}
      />

      {/* Setpoint marker: where the loop has been told to go. */}
      <div
        ref={targetRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -mt-2 -ml-2 h-4 w-4 will-change-transform"
      >
        <div className="absolute top-1/2 left-0 h-px w-full bg-ink-faint" />
        <div className="absolute top-0 left-1/2 h-full w-px bg-ink-faint" />
      </div>

      {/* Plant output: where it actually is. */}
      <div
        ref={objectRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -mt-[13px] -ml-[13px] h-[26px] w-[26px] rounded-full border-[1.5px] border-(--stage-accent) will-change-transform"
      />
    </div>
  );
});
