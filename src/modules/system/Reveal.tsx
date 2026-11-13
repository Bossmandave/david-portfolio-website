"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

import { SecondOrder } from "@/core/control/second-order";
import { MOTION, resolveMotion } from "@/design/motion";
import { useRender, useSimulate } from "@/engine/runtime/RuntimeProvider";
import { useReducedMotion } from "@/engine/runtime/useReducedMotion";

/**
 * An entrance solved rather than eased.
 *
 * There is no duration and no cubic-bezier: the element is a plant commanded from 0 to 1
 * on the `arrive` token, and it takes however long ζ and ωₙ say it takes. The overshoot
 * you see at the top of the travel is the same overshoot the control rig measures — this
 * is not an imitation of the effect, it is the effect.
 */
export function Reveal({
  children,
  delay = 0,
  distance = 22,
  className,
}: {
  children: ReactNode;
  /** Seconds before this element is commanded to arrive. */
  delay?: number;
  /** Travel in pixels. Negative values arrive from above. */
  distance?: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // A live simulation object is mutable by nature, so it belongs in a ref. Constructing
  // a throwaway per render is free — it holds three numbers — and buys lazy-init
  // gymnastics being unnecessary.
  const springRef = useRef(new SecondOrder(MOTION.arrive.zeta, MOTION.arrive.omegaN, 0));
  const clock = useRef(0);
  const finished = useRef(false);

  useEffect(() => {
    const token = resolveMotion(MOTION.arrive, reducedMotion);
    springRef.current.zeta = token.zeta;
    springRef.current.omegaN = token.omegaN;
  }, [reducedMotion]);

  /**
   * A returning visitor's boot flag is stamped onto <html> before hydration (see
   * layout.tsx), and BootSequence checks it to skip the overlay entirely — but that
   * overlay is the only thing that ever hid this entrance from a first-time visitor. On
   * a first visit the full fade-in plays out behind an opaque boot screen and is never
   * actually seen; without this check, a returning visitor has no such screen, so the
   * exact same raw animation — every element arriving on its own schedule — plays out
   * fully exposed instead of simply being there already. A layout effect runs before
   * paint, so the snap itself is never a visible frame.
   */
  useLayoutEffect(() => {
    if (document.documentElement.dataset.booted !== "1") return;

    const node = ref.current;
    springRef.current.snap(1);
    finished.current = true;
    if (node) {
      node.style.opacity = "1";
      node.style.transform = "";
      node.style.willChange = "";
    }
  }, []);

  useSimulate((dt) => {
    if (finished.current) return;
    const spring = springRef.current;
    clock.current += dt;
    if (clock.current >= delay) spring.target = 1;
    spring.step(dt);
  });

  useRender(() => {
    const node = ref.current;
    if (!node || finished.current) return;

    const spring = springRef.current;
    const progress = spring.value;
    node.style.opacity = Math.min(1, Math.max(0, progress)).toFixed(3);
    node.style.transform = `translate3d(0, ${((1 - progress) * distance).toFixed(2)}px, 0)`;

    // Once settled, drop the inline transform so the element stops being a
    // compositor layer it no longer needs to be.
    if (spring.target === 1 && spring.settled) {
      finished.current = true;
      node.style.opacity = "1";
      node.style.transform = "";
      node.style.willChange = "";
    }
  });

  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: 0, willChange: "transform, opacity" }}
    >
      {children}
    </div>
  );
}
