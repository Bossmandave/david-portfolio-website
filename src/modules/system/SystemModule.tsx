"use client";

import Link from "next/link";

import { MOTION } from "@/design/motion";
import { AmbientField } from "@/modules/system/AmbientField";
import { Reveal } from "@/modules/system/Reveal";

const IDENTITIES = [
  "Frontend Engineer",
  "Mechatronics Engineer",
  "AI Interfaces",
];

/** Parallax depth. Layers nearer the reader move least, which is how depth reads. */
const parallax = (depth: number) => ({
  transform: `translate3d(calc(var(--sys-x) * ${-depth}px), calc(var(--sys-y) * ${-depth}px), 0)`,
});

export function SystemModule() {
  const drift = MOTION.drift;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-void text-ink">
      <AmbientField />

      <main
        id="main"
        className="relative mx-auto flex min-h-dvh max-w-[1120px] flex-col justify-center px-6 py-24 sm:px-10"
      >
        <div style={parallax(6)}>
          <Reveal delay={0.15}>
            {/* Sized so nineteen monospaced characters still hold one line at the
                widest breakpoint — a three-part name needs more room than two. */}
            <h1 className="font-mono text-[clamp(2.15rem,7.6vw,4.75rem)] leading-[1.02] font-medium tracking-[-0.035em] text-balance">
              David Uchenna Agodi
            </h1>
          </Reveal>
        </div>

        <div style={parallax(10)}>
          <Reveal delay={0.3} className="mt-6">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.2em] text-ink-dim uppercase sm:text-[12px]">
              {IDENTITIES.map((identity, index) => (
                <span key={identity} className="flex items-center gap-3">
                  {index > 0 ? (
                    <span aria-hidden className="text-ink-faint">
                      ·
                    </span>
                  ) : null}
                  {identity}
                </span>
              ))}
            </p>
          </Reveal>
        </div>

        <div style={parallax(14)}>
          <Reveal delay={0.45} className="mt-10">
            <p className="max-w-[54ch] text-[clamp(1rem,2.2vw,1.1875rem)] leading-[1.55] text-ink-dim">
              I build production interfaces for AI products. I came to them
              through control systems — which is why nothing on this page eases.{" "}
              <span className="text-ink">It settles.</span>
            </p>
          </Reveal>

          <Reveal delay={0.65} distance={12} className="mt-10">
            <Link
              href="/work"
              className="group inline-flex items-baseline gap-3 border-b border-line-bright pb-1.5 font-mono text-[12px] tracking-[0.16em] text-ink uppercase transition-colors hover:border-response hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-6 focus-visible:outline-response"
            >
              Module 02 — Work
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </Reveal>
        </div>
      </main>

      {/* The instrument line. Small enough to ignore, present enough to notice twice. */}
      {/* Bottom-left on phones, where it would otherwise collide with the module
          marker; back to the right once there is room for both. */}
      <Reveal
        delay={0.9}
        distance={8}
        className="absolute bottom-6 left-6 sm:right-10 sm:bottom-8 sm:left-auto"
      >
        {/* The tuning this page is actually running. It opens the module where you
            can change it — not the raw instrument, which is a deeper cut linked
            from inside Control. */}
        <Link
          href="/control"
          className="group flex items-baseline gap-3 font-mono text-[11px] tracking-[0.12em] text-ink-faint tabular-nums transition-colors hover:text-ink focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-response"
        >
          <span>
            ζ {drift.zeta.toFixed(2)} · ωₙ {drift.omegaN.toFixed(1)} · drift
          </span>
          {/* Always visible where there is no hover to reveal it — an affordance that
              only appears on hover is invisible on a phone. */}
          <span className="text-response opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
            tune it →
          </span>
        </Link>
      </Reveal>

      <Reveal
        delay={1.05}
        distance={8}
        className="absolute bottom-8 left-10 hidden sm:block"
      >
        <p className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
          Module 01 — System
        </p>
      </Reveal>
    </div>
  );
}
