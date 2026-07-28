"use client";

import { memo, useEffect, useRef } from "react";

import { trackPointer } from "@/engine/input/pointer";
import { useRender } from "@/engine/runtime/RuntimeProvider";
import { useControl } from "@/modules/control/context";

/** Velocity at which lean saturates, px/s. */
const LEAN_REFERENCE = 3200;

/**
 * The thing under control is a piece of interface, not an abstract dot.
 *
 * This is the whole difference between a physics demo and the argument the site is
 * making. A circle overshooting is a curiosity; a card of real UI — type, a button, a
 * status line — ringing and hunting because you took the damping out is the site
 * misbehaving in front of you, and that is the only version anyone remembers.
 */
export const Subject = memo(function Subject() {
  const { system, pointer } = useControl();

  const hostRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const wasDiverged = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const first = system.bounds.width === 0;
      system.setBounds(rect.width, rect.height);
      if (first) system.reset();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    const detach = trackPointer(host, pointer);

    return () => {
      observer.disconnect();
      detach();
    };
  }, [system, pointer]);

  useRender(() => {
    const card = cardRef.current;
    const inner = innerRef.current;
    const target = targetRef.current;
    const error = errorRef.current;
    const host = hostRef.current;
    if (!card || !inner || !target || !error || !host) return;

    const x = system.plantX.position;
    const y = system.plantY.position;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const vx = system.plantX.velocity;
    const vy = system.plantY.velocity;

    // Lean into travel. The card is a rigid body being dragged by its centre, so it
    // should trail its own motion the way a real one would.
    const lean = Math.max(-9, Math.min(9, (vx / LEAN_REFERENCE) * 9));

    card.style.transform =
      `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${lean.toFixed(3)}deg)`;

    // Contents lag the frame slightly, so the card reads as layered rather than
    // as one flat sticker being slid around.
    inner.style.transform = `translate3d(${(-vx / 900).toFixed(2)}px, ${(-vy / 900).toFixed(2)}px, 0)`;

    const setX = system.setpoint.x;
    const setY = system.setpoint.y;
    target.style.transform = `translate3d(${setX.toFixed(2)}px, ${setY.toFixed(2)}px, 0)`;

    const dx = x - setX;
    const dy = y - setY;
    const distance = Math.hypot(dx, dy);
    error.style.transform =
      `translate3d(${setX.toFixed(2)}px, ${setY.toFixed(2)}px, 0) ` +
      `rotate(${Math.atan2(dy, dx).toFixed(4)}rad) scaleX(${distance.toFixed(2)})`;
    error.style.opacity = Math.min(0.5, distance / 110).toFixed(3);

    if (system.diverged !== wasDiverged.current) {
      wasDiverged.current = system.diverged;
      host.dataset.diverged = String(system.diverged);
    }
  });

  return (
    /* `touch-none` so a drag inside the stage commands the loop rather than scrolling
       the page away. Scoped to this element alone — everything around it scrolls
       normally, so nobody gets trapped inside a 300px block they cannot swipe past. */
    <div
      ref={hostRef}
      data-diverged="false"
      className="group/stage relative h-[300px] w-full touch-none overflow-hidden border border-line bg-panel [--accent:var(--color-response)] data-[diverged=true]:[--accent:var(--color-danger)] sm:h-[400px] md:cursor-crosshair lg:h-[440px]"
      aria-label="Tuning stage. The card is the plant output, chasing a moving target. Drag inside to command it."
    >
      {/* Touch has no hover, so the affordance has to be stated. */}
      <p className="pointer-events-none absolute top-3 left-3 z-10 font-mono text-[10px] tracking-[0.18em] text-ink-faint uppercase md:hidden">
        Drag inside to command it
      </p>

      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div
        ref={errorRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 h-px w-px origin-left bg-(--accent) will-change-transform"
      />

      <div
        ref={targetRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -mt-2 -ml-2 h-4 w-4 will-change-transform"
      >
        <div className="absolute top-1/2 left-0 h-px w-full bg-ink-faint" />
        <div className="absolute top-0 left-1/2 h-full w-px bg-ink-faint" />
      </div>

      {/* The plant output: an actual piece of interface.
          The positioned element is deliberately zero-sized, so its transform origin
          sits exactly on the commanded point and the card — centred on it by its own
          translate — rotates about its own middle. That decouples centring from the
          card's dimensions, which is what lets the width change per breakpoint
          without a matching negative margin to keep in sync. */}
      <div
        ref={cardRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 h-0 w-0 will-change-transform"
      >
        <div className="w-[186px] -translate-x-1/2 -translate-y-1/2 border border-(--accent)/70 bg-raised/95 shadow-[0_20px_50px_-24px_#000] sm:w-[248px]">
        <div ref={innerRef} className="p-3.5 will-change-transform sm:p-4">
          <div className="flex items-center gap-2.5">
            <span className="h-6 w-6 shrink-0 rounded-full border border-(--accent)/60 bg-(--accent)/15" />
            <span className="min-w-0">
              <span className="block font-mono text-[12px] leading-tight text-ink">
                Plant output
              </span>
              <span className="block font-mono text-[9px] tracking-[0.16em] text-ink-faint uppercase">
                under control
              </span>
            </span>
          </div>

          <div className="mt-3.5 space-y-1.5">
            <span className="block h-1 w-full bg-line-bright" />
            <span className="block h-1 w-4/5 bg-line-bright" />
            <span className="block h-1 w-3/5 bg-line-bright" />
          </div>

          <span className="mt-4 inline-block border border-(--accent)/50 bg-(--accent)/10 px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-(--accent) uppercase">
            Settling
          </span>
          </div>
        </div>
      </div>
    </div>
  );
});
