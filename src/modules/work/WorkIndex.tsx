"use client";

import Link from "next/link";

import { VISIBLE_PROJECTS } from "@/content/projects";
import { VISIBLE_SHIPPED } from "@/content/shipped";
import { AmbientField } from "@/modules/system/AmbientField";
import { Reveal } from "@/modules/system/Reveal";

export function WorkIndex() {
  return (
    <div className="relative min-h-dvh bg-void text-ink">
      <AmbientField />

      <main
        id="main"
        className="relative mx-auto max-w-[1120px] px-6 pt-20 pb-28 sm:px-10"
      >
        <Reveal delay={0.1}>
          <p className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
            Module 02 — Work
          </p>
          <h1 className="mt-4 font-mono text-[clamp(2rem,6vw,3.25rem)] leading-[1.02] font-medium tracking-[-0.03em] text-balance">
            Systems, and what they cost
          </h1>
          <p className="mt-6 max-w-[58ch] text-[1.0625rem] leading-[1.6] text-ink-dim">
            Each of these is written the same way: the problem, the constraints
            that were real, the decision that could have gone the other way, and
            what it cost to make it. The trade-off is the part worth reading.
          </p>
        </Reveal>

        <ol className="mt-16 border-t border-line">
          {VISIBLE_PROJECTS.map((project, index) => (
            <li key={project.slug}>
              <Reveal delay={0.25 + index * 0.08} distance={14}>
                <Link
                  href={`/work/${project.slug}`}
                  className="group relative block border-b border-line py-7 transition-colors focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-response"
                >
                  {/* Leading rule: the row's own state, not a decoration. */}
                  <span
                    aria-hidden
                    className="absolute top-0 -left-4 h-full w-px origin-top scale-y-0 bg-response transition-transform duration-300 group-hover:scale-y-100 group-focus-visible:scale-y-100 sm:-left-6"
                  />

                  <div className="grid items-baseline gap-x-8 gap-y-2 md:grid-cols-[4rem_minmax(0,1fr)_auto]">
                    <span className="font-mono text-[11px] tracking-[0.14em] text-ink-faint tabular-nums">
                      {project.year}
                    </span>

                    <div className="min-w-0">
                      <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[1.25rem] leading-tight tracking-[-0.02em] text-ink transition-colors group-hover:text-response">
                        {project.title}
                        {project.placeholder ? (
                          <span className="border border-warn/50 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em] text-warn uppercase">
                            Placeholder
                          </span>
                        ) : null}
                      </h2>

                      <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-[1.55] text-ink-dim">
                        {project.summary}
                      </p>

                      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.18em] text-ink-faint uppercase">
                        {project.domains.map((domain) => (
                          <span key={domain}>{domain}</span>
                        ))}
                      </p>
                    </div>

                    <span
                      aria-hidden
                      className="hidden font-mono text-[12px] text-ink-faint transition-all duration-300 group-hover:translate-x-1 group-hover:text-response md:inline"
                    >
                      →
                    </span>
                  </div>
                </Link>
              </Reveal>
            </li>
          ))}
        </ol>

        {/* The second tier, and framed as such. Presenting these with the same weight
            as the case studies would flatten the difference between "here is how I
            think" and "here is a thing that works". */}
        <Reveal delay={0.5} className="mt-20">
          <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
            Also shipped
          </h2>
          <p className="mt-3 max-w-[52ch] text-[13px] leading-[1.6] text-ink-dim">
            Briefs, deadlines and stakeholders. No thesis attached — they work, and the
            links prove it.
          </p>

          <ul className="mt-6 border-t border-line">
            {VISIBLE_SHIPPED.map((entry) => (
              <li
                key={entry.name}
                className="grid items-baseline gap-x-8 gap-y-1.5 border-b border-line py-5 md:grid-cols-[4rem_minmax(0,1fr)_auto]"
              >
                <span className="font-mono text-[11px] tracking-[0.14em] text-ink-faint tabular-nums">
                  {entry.year}
                </span>

                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[15px] leading-tight text-ink">
                    {entry.name}
                    <span className="font-mono text-[10px] tracking-[0.16em] text-ink-faint uppercase">
                      {entry.context}
                    </span>
                    {entry.placeholder ? (
                      <span className="border border-warn/50 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.18em] text-warn uppercase">
                        Placeholder
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1.5 max-w-[62ch] text-[13px] leading-[1.55] text-ink-dim">
                    {entry.summary}
                  </p>
                  <p className="mt-2 font-mono text-[10px] tracking-[0.1em] text-ink-faint">
                    {entry.stack.join(" · ")}
                  </p>
                </div>

                {entry.href ? (
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-mono text-[11px] tracking-[0.14em] text-ink-dim uppercase transition-colors hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response"
                  >
                    Visit ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </Reveal>
      </main>
    </div>
  );
}
