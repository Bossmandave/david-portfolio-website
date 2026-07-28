"use client";

import { useEffect, useRef, useState } from "react";

import { analyseLoop } from "@/core/control/analysis";
import { MOTION } from "@/design/motion";
import { useRender, useSimulate } from "@/engine/runtime/RuntimeProvider";
import { useReducedMotion } from "@/engine/runtime/useReducedMotion";
import { DEFAULT_SETTINGS } from "@/modules/control/presets";

const SIMULATION_HZ = 240;
/** Seconds. Anything longer is a splash screen, and splash screens died for reasons. */
const DURATION = 1.9;
const LINE_INTERVAL = 0.2;

/**
 * Every line is read from the system it claims to be starting.
 *
 * A boot sequence reciting invented numbers is set dressing. These are computed from
 * the same constants the site actually runs on, so retuning the plant changes what the
 * boot reports — which is the only version worth showing on a page arguing that the
 * engineering is real.
 */
function diagnostics(): string[] {
  const analysis = analyseLoop(DEFAULT_SETTINGS.gains, DEFAULT_SETTINGS.plant);
  const { gains, plant, options } = DEFAULT_SETTINGS;

  return [
    `runtime · fixed clock ${SIMULATION_HZ} Hz`,
    `control core · pid · ${options.antiWindup ? "anti-windup" : "no anti-windup"} · d-on-${options.derivativeSource}`,
    `plant · second order · m ${plant.mass.toFixed(1)} · load ${plant.load}`,
    `gains · kp ${gains.kp} · ki ${gains.ki} · kd ${gains.kd}`,
    `stability · routh–hurwitz · margin ${analysis.stabilityMargin.toFixed(1)}×`,
    `motion · ζ ${MOTION.arrive.zeta.toFixed(2)} · ωₙ ${MOTION.arrive.omegaN.toFixed(1)} · arrive`,
    `system ready`,
  ];
}

/** Analytic step response, drawn progressively as the loop "comes up". */
function stepResponse(t: number, zeta: number, omegaN: number): number {
  if (t <= 0) return 0;
  const wd = omegaN * Math.sqrt(1 - zeta * zeta);
  const phi = Math.acos(zeta);
  return (
    1 - (Math.exp(-zeta * omegaN * t) / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t + phi)
  );
}

export function BootSequence() {
  const reducedMotion = useReducedMotion();
  const [done, setDone] = useState(false);
  const [lines] = useState(diagnostics);

  const hostRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLLIElement | null>>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  const clock = useRef(0);
  const skipped = useRef(false);
  const finished = useRef(false);
  const abort = useRef(false);

  /**
   * A returning visitor is flagged before first paint by the inline script in the
   * document head, and the stylesheet hides the overlay on that attribute — so there
   * is never a visible frame to remove. This only decides whether the *sequence*
   * should run, and it raises a flag the frame loop acts on rather than calling
   * setState from inside an effect and cascading a second render.
   */
  useEffect(() => {
    if (document.documentElement.dataset.booted === "1" || reducedMotion) {
      abort.current = true;
      return;
    }

    const skip = () => {
      skipped.current = true;
    };

    // Any input at all ends it. A sequence you cannot escape is a toll, not an intro.
    window.addEventListener("pointerdown", skip, { passive: true });
    window.addEventListener("keydown", skip);
    window.addEventListener("wheel", skip, { passive: true });
    window.addEventListener("touchstart", skip, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchstart", skip);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (done) {
      try {
        sessionStorage.setItem("boot", "1");
        document.documentElement.dataset.booted = "1";
      } catch {
        // Private mode with storage disabled: the boot simply plays again next time.
      }
    }
  }, [done]);

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
  }, [done]);

  useSimulate((dt) => {
    if (finished.current) return;
    clock.current += skipped.current ? dt * 9 : dt;
  });

  useRender(() => {
    if (finished.current) return;

    // Nothing to play: unmount on the next frame. Not an effect, so no cascade.
    if (abort.current) {
      finished.current = true;
      setDone(true);
      return;
    }

    const t = clock.current;

    for (let i = 0; i < lineRefs.current.length; i++) {
      const node = lineRefs.current[i];
      if (!node) continue;
      const shown = t >= i * LINE_INTERVAL;
      const next = shown ? "1" : "0";
      if (node.style.opacity !== next) node.style.opacity = next;
    }

    const context = contextRef.current;
    const { width, height } = sizeRef.current;
    if (context && width > 0) {
      const span = 1.1;
      const progress = Math.min(1, t / (DURATION * 0.72));
      context.clearRect(0, 0, width, height);

      context.strokeStyle = "#262c38";
      context.beginPath();
      context.moveTo(0, height * 0.28);
      context.lineTo(width, height * 0.28);
      context.stroke();

      context.strokeStyle = "#6fe3f2";
      context.lineWidth = 1.5;
      context.beginPath();
      const steps = 160;
      for (let i = 0; i <= steps * progress; i++) {
        const tt = (i / steps) * span;
        const value = stepResponse(tt, MOTION.arrive.zeta, MOTION.arrive.omegaN);
        const x = (tt / span) * width;
        const y = height * 0.92 - value * height * 0.64;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }

    if (t >= DURATION) {
      finished.current = true;
      const host = hostRef.current;
      if (host) host.style.opacity = "0";
      // Let the fade finish before unmounting, so the hero is not revealed by a cut.
      window.setTimeout(() => setDone(true), 420);
    }
  });

  if (done) return null;

  return (
    <div
      ref={hostRef}
      className="boot-overlay fixed inset-0 z-40 flex items-center justify-center bg-void transition-opacity duration-[400ms]"
      role="status"
      aria-label="System starting"
    >
      <div className="w-full max-w-[520px] px-6">
        <canvas ref={canvasRef} aria-hidden className="h-16 w-full" />

        <ul className="mt-6 space-y-1.5">
          {lines.map((line, index) => (
            <li
              key={line}
              ref={(node) => {
                lineRefs.current[index] = node;
              }}
              style={{ opacity: 0 }}
              className={`font-mono text-[11px] leading-relaxed tracking-[0.04em] tabular-nums ${
                index === lines.length - 1 ? "text-response" : "text-ink-faint"
              }`}
            >
              <span className="mr-2 text-ink-faint/60">›</span>
              {line}
            </li>
          ))}
        </ul>

        <p className="mt-6 font-mono text-[9px] tracking-[0.24em] text-ink-faint/60 uppercase">
          Press anything to skip
        </p>
      </div>
    </div>
  );
}
