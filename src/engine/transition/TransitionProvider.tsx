"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { SecondOrder } from "@/core/control/second-order";
import { moduleForPath, type ModuleDescriptor } from "@/content/modules";
import { MOTION, resolveMotion } from "@/design/motion";
import { useRender, useSimulate } from "@/engine/runtime/RuntimeProvider";
import { useReducedMotion } from "@/engine/runtime/useReducedMotion";

type Phase = "idle" | "covering" | "revealing";

interface TransitionValue {
  go: (href: string) => void;
  phase: Phase;
  target: ModuleDescriptor | null;
}

const TransitionContext = createContext<TransitionValue | null>(null);

/** Named to avoid shadowing React's own `useTransition`, which means something else. */
export function useModuleTransition(): TransitionValue {
  const value = useContext(TransitionContext);
  if (!value) {
    throw new Error("useModuleTransition must be used inside <TransitionProvider>");
  }
  return value;
}

/**
 * Moves between modules as a channel switch rather than a page load.
 *
 * The cover is driven by the same solver as everything else, on the `settle` token —
 * critically damped, because a full-screen cover that overshoots would bounce a solid
 * panel across the viewport. Nothing here is eased by hand.
 *
 * Navigation is intercepted at the document level rather than through a bespoke link
 * component, so every existing `next/link` on the site inherits the behaviour without
 * being rewritten, and anything that opts out — new tab, modifier-click, external
 * host, download — keeps working exactly as the browser intends.
 */
export function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [target, setTarget] = useState<ModuleDescriptor | null>(null);

  const coverRef = useRef(new SecondOrder(MOTION.settle.zeta, MOTION.settle.omegaN, 0));
  const bandRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const pendingHref = useRef<string | null>(null);

  // The frame loop needs the current phase, and a render-time ref write is not safe
  // under concurrent rendering — a discarded render would publish a phase that never
  // committed. Writing it after commit is both correct and sufficient: the loop reads
  // it on the next frame, which is always after the commit that changed it.
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const token = resolveMotion(MOTION.settle, reducedMotion);
    coverRef.current.zeta = token.zeta;
    coverRef.current.omegaN = token.omegaN;
  }, [reducedMotion]);

  const go = useCallback(
    (href: string) => {
      if (href === pathname || phaseRef.current !== "idle") return;

      pendingHref.current = href;
      setTarget(moduleForPath(href));
      setPhase("covering");
      coverRef.current.target = 1;
    },
    [pathname],
  );

  // Cover fully, then commit the navigation. Pushing first would swap the content
  // underneath a half-drawn cover, which is the flicker this exists to remove.
  useSimulate((dt) => {
    const cover = coverRef.current;
    cover.step(dt);

    if (
      phaseRef.current === "covering" &&
      pendingHref.current &&
      cover.value > 0.985
    ) {
      const href = pendingHref.current;
      pendingHref.current = null;
      router.push(href);
    }
  });

  // The new route has mounted; lift the cover. Holding until this point means a slow
  // route keeps the cover up rather than flashing an empty frame.
  useEffect(() => {
    if (phaseRef.current !== "covering" || pendingHref.current) return;

    const raf = requestAnimationFrame(() => {
      setPhase("revealing");
      coverRef.current.target = 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  useRender(() => {
    const band = bandRef.current;
    const label = labelRef.current;
    if (!band || !label) return;

    const value = Math.max(0, Math.min(1, coverRef.current.value));

    // A hairline that opens into a full field and closes back to a hairline: the
    // scope trace flatlining and re-acquiring.
    band.style.transform = `scaleY(${value.toFixed(4)})`;
    band.style.opacity = value > 0.001 ? "1" : "0";
    label.style.opacity = Math.max(0, (value - 0.55) / 0.45).toFixed(3);

    if (phaseRef.current === "revealing" && value < 0.004) {
      setPhase("idle");
      setTarget(null);
    }
  });

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Anything the browser would treat specially is left to the browser.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        !href ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      ) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname) return;

      event.preventDefault();
      go(url.pathname + url.search);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [go, pathname]);

  return (
    <TransitionContext.Provider value={{ go, phase, target }}>
      {children}

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
        style={{ visibility: phase === "idle" ? "hidden" : "visible" }}
      >
        <div
          ref={bandRef}
          className="absolute inset-0 origin-center bg-void will-change-transform"
          style={{ transform: "scaleY(0)", opacity: 0 }}
        />
        <div
          ref={labelRef}
          className="relative flex items-baseline gap-3 font-mono text-[11px] tracking-[0.24em] text-ink-faint uppercase will-change-[opacity]"
          style={{ opacity: 0 }}
        >
          <span className="text-response">{target?.index ?? ""}</span>
          <span>{target?.label ?? ""}</span>
        </div>
      </div>

      {/* Route changes are silent to assistive technology unless announced. */}
      <div aria-live="polite" className="sr-only">
        {phase === "revealing" && target ? `${target.label} module loaded` : ""}
      </div>
    </TransitionContext.Provider>
  );
}
