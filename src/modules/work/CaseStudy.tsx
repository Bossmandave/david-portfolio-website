"use client";

import Link from "next/link";

import { Section } from "@/components/Section";
import type { Project } from "@/content/types";
import { AmbientField } from "@/modules/system/AmbientField";
import { Reveal } from "@/modules/system/Reveal";
import { Gallery } from "@/modules/work/Gallery";

export function CaseStudy({ project }: { project: Project }) {
  return (
    <div className="relative min-h-dvh bg-void text-ink">
      <AmbientField />

      <main
        id="main"
        className="relative mx-auto max-w-[1120px] px-6 pt-16 pb-28 sm:px-10"
      >
        <Reveal delay={0.05} distance={12}>
          <Link
            href="/work"
            className="inline-flex items-baseline gap-2 font-mono text-[10px] tracking-[0.18em] text-ink-faint uppercase transition-colors hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-response"
          >
            <span aria-hidden>←</span> All work
          </Link>
        </Reveal>

        <Reveal delay={0.15}>
          <header className="mt-10">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.18em] text-ink-faint uppercase tabular-nums">
              <span>{project.year}</span>
              {project.domains.map((domain) => (
                <span key={domain}>· {domain}</span>
              ))}
            </p>

            <h1 className="mt-5 max-w-[26ch] font-mono text-[clamp(2rem,6vw,3.5rem)] leading-[1.02] font-medium tracking-[-0.03em] text-balance">
              {project.title}
            </h1>

            <p className="mt-7 max-w-[58ch] text-[clamp(1rem,2vw,1.1875rem)] leading-[1.55] text-ink">
              {project.summary}
            </p>

            {/* Directly under the summary, not eight sections down. A live URL is the
                strongest evidence on the page — a reader who wants to see the thing
                working should not have to read a case study first to find it. */}
            {project.links.length > 0 ? (
              <ul className="mt-7 flex flex-wrap gap-2">
                {project.links.map((link) => (
                  <li key={link.label}>
                    {link.private ? (
                      <span className="flex items-center gap-2 border border-line px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] text-ink-faint">
                        {link.label}
                        <span aria-hidden>·</span>
                        <span className="text-[10px] tracking-[0.18em] uppercase">
                          private
                        </span>
                      </span>
                    ) : (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 border border-response/45 bg-response/8 px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] text-response transition-colors hover:border-response hover:bg-response/16 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response"
                      >
                        {link.label}
                        <span aria-hidden>↗</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </header>
        </Reveal>

        {project.placeholder ? (
          <p className="mt-10 border border-warn/40 bg-warn/5 px-4 py-3 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-warn">
            Placeholder. This describes work that has not been written up yet —
            production builds refuse to compile while it exists.
          </p>
        ) : null}

        <div className="mt-14">
          {/* Scope first. Who did what, including where the boundary was — everything
              downstream is read through it, so it cannot come later. */}
          <Section label="Scope">
            <p className="max-w-[64ch] leading-[1.65] text-ink-dim">
              {project.role}
            </p>
          </Section>

          {/* After Scope and before the argument, deliberately. Screens shown first
              invite the reader to assume the whole product is yours; shown after the
              boundary has been stated, each one is read inside it. And a page this
              text-heavy needs the reader to see the artefact before paragraph six. */}
          {project.gallery && project.gallery.length > 0 ? (
            <Section label="Screens">
              <Gallery shots={project.gallery} />
            </Section>
          ) : null}

          <Section label="Problem">
            <p className="max-w-[64ch] leading-[1.65] text-ink-dim">
              {project.problem}
            </p>
          </Section>

          {project.constraints.length > 0 ? (
            <Section label="Constraints">
              <ul className="space-y-3">
                {project.constraints.map((constraint) => (
                  <li
                    key={constraint}
                    className="grid max-w-[64ch] grid-cols-[1rem_minmax(0,1fr)] gap-x-2 leading-[1.6] text-ink-dim"
                  >
                    <span
                      aria-hidden
                      className="pt-[0.45rem] font-mono text-[10px] text-ink-faint"
                    >
                      —
                    </span>
                    <span>{constraint}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {project.decisions.length > 0 ? (
            <Section label="Decisions">
              <div className="space-y-8">
                {project.decisions.map((decision) => (
                  <article key={decision.title}>
                    <h3 className="font-mono text-[1rem] leading-snug tracking-[-0.01em] text-ink">
                      {decision.title}
                    </h3>
                    <p className="mt-2.5 max-w-[64ch] leading-[1.65] text-ink-dim">
                      {decision.body}
                    </p>
                  </article>
                ))}
              </div>
            </Section>
          ) : null}

          {project.tradeoffs.length > 0 ? (
            <Section label="Trade-offs">
              <div className="space-y-px bg-line">
                {project.tradeoffs.map((tradeoff) => (
                  <div
                    key={tradeoff.gave}
                    className="grid gap-px bg-line sm:grid-cols-2"
                  >
                    <div className="bg-void px-4 py-4">
                      <p className="font-mono text-[10px] tracking-[0.2em] text-ink-faint uppercase">
                        Gave up
                      </p>
                      <p className="mt-2 leading-[1.6] text-ink-dim">
                        {tradeoff.gave}
                      </p>
                    </div>
                    <div className="bg-void px-4 py-4">
                      <p className="font-mono text-[10px] tracking-[0.2em] text-response uppercase">
                        Bought
                      </p>
                      <p className="mt-2 leading-[1.6] text-ink">
                        {tradeoff.got}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Deliberately after the argument and before the numbers: the breadth is
              real, but a reader who meets it first will read the case study as a list
              of features rather than as one point made properly. */}
          {project.alsoBuilt && project.alsoBuilt.length > 0 ? (
            <Section label="Also built">
              <div className="space-y-6">
                {project.alsoBuilt.map((item) => (
                  <article key={item.title}>
                    <h3 className="font-mono text-[0.9375rem] leading-snug tracking-[-0.01em] text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-[64ch] text-[0.9375rem] leading-[1.6] text-ink-dim">
                      {item.body}
                    </p>
                  </article>
                ))}
              </div>
            </Section>
          ) : null}

          {project.outcomes.length > 0 ? (
            <Section label="Results">
              <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
                {project.outcomes.map((outcome) => (
                  <div key={outcome.label} className="bg-void px-4 py-4">
                    <p className="font-mono text-[10px] tracking-[0.18em] text-ink-faint uppercase">
                      {outcome.label}
                    </p>
                    <p className="mt-1.5 font-mono text-[1.375rem] leading-none text-response tabular-nums">
                      {outcome.value}
                    </p>
                    {outcome.caveat ? (
                      <p className="mt-2.5 text-[12px] leading-[1.5] text-ink-faint">
                        {outcome.caveat}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="mt-4 max-w-[62ch] text-[12px] leading-[1.55] text-ink-faint">
                Ratios are given as raw counts rather than percentages. A
                percentage implies a precision that twenty attempts do not have.
              </p>
            </Section>
          ) : null}

          {/* Not "what I'd change" — that heading frames everything beneath it as
              outstanding, so a bug that was found AND fixed reads as still broken.
              This section holds both, and each entry states which it is. */}
          {project.lessons.length > 0 ? (
            <Section label="What I got wrong">
              <ul className="space-y-5">
                {project.lessons.map((lesson) => (
                  <li
                    key={lesson}
                    className="max-w-[64ch] border-l border-warn/40 pl-4 leading-[1.65] text-ink-dim"
                  >
                    {lesson}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {project.stack.length > 0 ? (
            <Section label="Stack">
              <ul className="flex flex-wrap gap-x-2 gap-y-2">
                {project.stack.map((item) => (
                  <li
                    key={item}
                    className="border border-line-bright px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-dim"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

        </div>
      </main>
    </div>
  );
}
