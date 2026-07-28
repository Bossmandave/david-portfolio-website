"use client";

import { memo, useEffect, useRef } from "react";

import { useRender } from "@/engine/runtime/RuntimeProvider";
import { useControl } from "@/modules/control/context";

const WINDOW_SECONDS = 4;
const MIN_SPAN = 140;
/** How fast the vertical axis chases a new range. Low enough that it never jitters. */
const RANGE_EASE = 0.06;

/**
 * Rolling trace of the loaded axis: commanded position against measured position.
 *
 * Deliberately plotted in screen orientation — larger values draw lower — so the trace
 * mirrors the stage directly above it. Droop appears as the measured line sitting under
 * the commanded one, which is exactly where the object sits on screen.
 */
export const Oscilloscope = memo(function Oscilloscope() {
  const { system } = useControl();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const range = useRef({ min: 0, max: 600 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    contextRef.current = context;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width: rect.width, height: rect.height };
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useRender(() => {
    const context = contextRef.current;
    if (!context) return;

    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;

    const measured = system.scopeMeasured;
    const commanded = system.scopeSetpoint;
    const count = measured.length;

    context.clearRect(0, 0, width, height);

    // --- vertical range ---------------------------------------------------------
    const a = measured.extent();
    const b = commanded.extent();
    let min = Math.min(a.min, b.min);
    let max = Math.max(a.max, b.max);

    // A diverged loop reports astronomical extents; clamping keeps the trace on screen
    // instead of collapsing it to a flat line at the origin.
    const limit = 1e5;
    min = Math.max(-limit, Math.min(limit, min));
    max = Math.max(-limit, Math.min(limit, max));

    const span = Math.max(MIN_SPAN, max - min);
    const centre = (min + max) / 2;
    const targetMin = centre - span * 0.62;
    const targetMax = centre + span * 0.62;

    range.current.min += (targetMin - range.current.min) * RANGE_EASE;
    range.current.max += (targetMax - range.current.max) * RANGE_EASE;

    const scale = height / (range.current.max - range.current.min || 1);
    const toY = (value: number) => (value - range.current.min) * scale;
    const toX = (index: number) => (index / Math.max(1, count - 1)) * width;

    // --- grid -------------------------------------------------------------------
    context.strokeStyle = "#15151c";
    context.lineWidth = 1;
    context.beginPath();
    for (let s = 1; s < WINDOW_SECONDS; s++) {
      const x = Math.round((s / WINDOW_SECONDS) * width) + 0.5;
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (let g = 1; g < 4; g++) {
      const y = Math.round((g / 4) * height) + 0.5;
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();

    if (count < 2) return;

    // --- commanded --------------------------------------------------------------
    context.setLineDash([3, 4]);
    context.strokeStyle = "#4a4a56";
    context.lineWidth = 1;
    context.beginPath();
    for (let i = 0; i < count; i++) {
      const value = commanded.at(i);
      if (!Number.isFinite(value)) continue;
      const y = toY(value);
      if (i === 0) context.moveTo(toX(i), y);
      else context.lineTo(toX(i), y);
    }
    context.stroke();
    context.setLineDash([]);

    // --- measured ---------------------------------------------------------------
    context.strokeStyle = system.diverged ? "#ff5f56" : "#7ee7ff";
    context.lineWidth = 1.5;
    context.lineJoin = "round";
    context.beginPath();
    let started = false;
    for (let i = 0; i < count; i++) {
      const value = measured.at(i);
      if (!Number.isFinite(value)) continue;
      const y = toY(value);
      if (!started) {
        context.moveTo(toX(i), y);
        started = true;
      } else {
        context.lineTo(toX(i), y);
      }
    }
    context.stroke();

    // Leading edge marker, so the eye finds "now" without hunting.
    const latest = measured.latest;
    if (Number.isFinite(latest)) {
      context.beginPath();
      context.arc(width - 1, toY(latest), 2.5, 0, Math.PI * 2);
      context.fillStyle = system.diverged ? "#ff5f56" : "#7ee7ff";
      context.fill();
    }
  });

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      role="img"
      aria-label="Oscilloscope trace comparing commanded position against measured plant position over the last four seconds."
    />
  );
});
