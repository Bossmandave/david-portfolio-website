"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { SecondOrder } from "@/core/control/second-order";
import { RingBuffer } from "@/core/signal/ring-buffer";
import { MODULES } from "@/content/modules";
import { useRender, useSimulate } from "@/engine/runtime/RuntimeProvider";
import { useReducedMotion } from "@/engine/runtime/useReducedMotion";
import { Reveal } from "@/modules/system/Reveal";

const SAMPLES = 260;
/** Seconds between setpoint flips. Shorter than the loop needs to settle, on purpose. */
const FLIP = 1.15;

/**
 * A loop hunting a setpoint it can never hold.
 *
 * The tuning is deliberately bad — almost no damping, and the target moves again
 * before the response has settled — so the trace keeps reaching and keeps missing.
 * Which is what a 404 is: a request for something that was never defined, retried
 * forever. It runs on the same solver as the rest of the site rather than being a
 * decorative squiggle.
 */
function LostSignal() {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  const measured = useRef(new RingBuffer(SAMPLES));
  const commanded = useRef(new RingBuffer(SAMPLES));
  const system = useRef(new SecondOrder(0.06, 11, 0));
  const clock = useRef(0);
  const decimator = useRef(0);

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

  useSimulate((dt) => {
    if (reducedMotion) return;

    clock.current += dt;
    system.current.target = Math.floor(clock.current / FLIP) % 2 === 0 ? 1 : -1;
    system.current.step(dt);

    // 240Hz simulation decimated to 60Hz of trace — plenty to draw, a quarter the work.
    if (++decimator.current >= 4) {
      decimator.current = 0;
      measured.current.push(system.current.value);
      commanded.current.push(system.current.target);
    }
  });

  useRender(() => {
    const context = contextRef.current;
    const { width, height } = sizeRef.current;
    if (!context || width === 0) return;

    const count = measured.current.length;
    context.clearRect(0, 0, width, height);

    const toY = (value: number) => height / 2 - value * height * 0.34;
    const toX = (index: number) => (index / Math.max(1, SAMPLES - 1)) * width;

    context.strokeStyle = "#15181f";
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(width, height / 2);
    context.stroke();

    if (count < 2) return;

    context.setLineDash([3, 4]);
    context.strokeStyle = "#464c59";
    context.lineWidth = 1;
    context.beginPath();
    for (let i = 0; i < count; i++) {
      const y = toY(commanded.current.at(i));
      if (i === 0) context.moveTo(toX(i), y);
      else context.lineTo(toX(i), y);
    }
    context.stroke();
    context.setLineDash([]);

    context.strokeStyle = "#ff5f56";
    context.lineWidth = 1.5;
    context.lineJoin = "round";
    context.beginPath();
    for (let i = 0; i < count; i++) {
      const y = toY(measured.current.at(i));
      if (i === 0) context.moveTo(toX(i), y);
      else context.lineTo(toX(i), y);
    }
    context.stroke();
  });

  return (
    <canvas
      ref={canvasRef}
      className="h-24 w-full"
      role="img"
      aria-label="An oscilloscope trace of a control loop repeatedly overshooting a target it never settles on."
    />
  );
}

export function NotFoundModule() {
  return (
    <div className="relative min-h-dvh bg-void text-ink">
      <main
        id="main"
        className="relative mx-auto flex min-h-dvh max-w-[1120px] flex-col justify-center px-6 py-24 sm:px-10"
      >
        <Reveal delay={0.1}>
          <p className="font-mono text-[10px] tracking-[0.22em] text-danger uppercase">
            Error 404 · no route
          </p>
          <h1 className="mt-4 font-mono text-[clamp(2.15rem,7.6vw,4.75rem)] leading-[1.02] font-medium tracking-[-0.035em] text-balance">
            Setpoint undefined
          </h1>
          <p className="mt-6 max-w-[56ch] text-[1.0625rem] leading-[1.6] text-ink-dim">
            Nothing is mapped to that address. Below is a loop chasing a target that
            was never defined — it reaches, misses, and reaches again, forever. Which
            is roughly what a 404 is.
          </p>
        </Reveal>

        <Reveal delay={0.3} className="mt-10 border border-line bg-panel p-2">
          <LostSignal />
        </Reveal>

        <Reveal delay={0.45} className="mt-10">
          <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
            Defined routes
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-2 gap-y-2">
            {MODULES.map((entry) => (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  className="flex items-baseline gap-2 border border-line-bright px-3 py-1.5 font-mono text-[11px] tracking-[0.14em] text-ink-dim uppercase transition-colors hover:border-response/60 hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response"
                >
                  <span className="text-ink-faint">{entry.index}</span>
                  {entry.label}
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </main>
    </div>
  );
}
