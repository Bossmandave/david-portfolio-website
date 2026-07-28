"use client";

import { useState } from "react";

import { PATH_STAGES } from "@/content/path";
import { AmbientField } from "@/modules/system/AmbientField";
import { Reveal } from "@/modules/system/Reveal";
import { PathDiagram } from "@/modules/path/PathDiagram";

export function PathModule() {
  const [selected, setSelected] = useState(PATH_STAGES[0].id);
  const stage = PATH_STAGES.find((s) => s.id === selected) ?? PATH_STAGES[0];

  return (
    <div className="relative min-h-dvh bg-void text-ink">
      <AmbientField />

      <main
        id="main"
        className="relative mx-auto max-w-[1120px] px-6 pt-20 pb-28 sm:px-10"
      >
        <Reveal delay={0.1}>
          <p className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
            Module 03 — Path
          </p>
          <h1 className="mt-4 font-mono text-[clamp(2rem,6vw,3.25rem)] leading-[1.02] font-medium tracking-[-0.03em] text-balance">
            One chain, four stages
          </h1>
          <p className="mt-6 max-w-[58ch] text-[1.0625rem] leading-[1.6] text-ink-dim">
            Not a timeline and not a skill cloud. A block diagram, because that
            is what an engineer reaches for to describe a system — and because
            the route from a motor controller to a streaming interface is a
            straighter line than it looks.
          </p>
        </Reveal>

        <Reveal delay={0.28} className="mt-14">
          <PathDiagram selected={selected} onSelect={setSelected} />

          {/* The feedback path. Drawn because it is true: every stage keeps
              informing the ones before it. */}
          <div aria-hidden className="mt-3 hidden items-center gap-3 md:flex">
            <span className="h-3 w-px bg-line-bright" />
            <span className="h-px flex-1 bg-line-bright" />
            <span className="font-mono text-[9px] tracking-[0.22em] text-ink-faint uppercase">
              feedback
            </span>
            <span className="h-px flex-1 bg-line-bright" />
            <span className="h-3 w-px bg-line-bright" />
          </div>
        </Reveal>

        <Reveal delay={0.42} className="mt-12">
          <div
            id="stage-panel"
            role="tabpanel"
            aria-labelledby={`stage-tab-${stage.id}`}
            tabIndex={0}
            className="border-t border-line pt-10 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-response"
          >
            <p className="max-w-[46ch] font-mono text-[clamp(1.0625rem,2.6vw,1.5rem)] leading-[1.3] tracking-[-0.02em] text-response text-balance">
              {stage.lesson}
            </p>

            <div className="mt-10 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div>
                <p className="max-w-[64ch] leading-[1.7] text-ink-dim">
                  {stage.body}
                </p>

                <h3 className="mt-9 font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
                  In the block
                </h3>
                <ul className="mt-3.5 flex flex-wrap gap-x-2 gap-y-2">
                  {stage.skills.map((skill) => (
                    <li
                      key={skill}
                      className="border border-line-bright px-2 py-1 font-mono text-[11px] tracking-[0.06em] text-ink-dim"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase">
                  Where
                </h3>
                <ul className="mt-3.5 space-y-4">
                  {stage.roles.map((role) => (
                    <li
                      key={`${role.org}-${role.title}`}
                      className="border-l border-line-bright pl-4"
                    >
                      <p className="font-mono text-[13px] leading-snug text-ink">
                        {role.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-snug text-ink-dim">
                        {role.org}
                      </p>
                      {role.note ? (
                        <p className="mt-1 font-mono text-[11px] leading-snug text-ink-faint tabular-nums">
                          {role.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </main>
    </div>
  );
}
