"use client";

import { RESUME } from "@/content/resume";

function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-2 border border-line-bright px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] text-ink-dim uppercase transition-colors hover:border-response/60 hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response"
    >
      Print · save as PDF
    </button>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-3 border-t border-line py-7 md:grid-cols-[7rem_minmax(0,1fr)] print:break-inside-avoid print:py-4">
      <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase md:pt-1">
        {label}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function ResumeModule({ pdfHref }: { pdfHref: string | null }) {
  return (
    <div className="resume-sheet relative min-h-dvh bg-void text-ink">
      <main
        id="main"
        className="relative mx-auto max-w-[880px] px-6 pt-16 pb-24 sm:px-10 print:max-w-none print:px-0 print:pt-0 print:pb-0"
      >
        <header>
          <h1 className="font-mono text-[clamp(1.75rem,5vw,2.75rem)] leading-[1.05] font-medium tracking-[-0.03em]">
            {RESUME.name}
          </h1>
          <p className="mt-3 font-mono text-[11px] tracking-[0.18em] text-ink-dim uppercase">
            {RESUME.title}
          </p>

          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-ink-dim">
            <a href={`mailto:${RESUME.contact.email}`} className="hover:text-response">
              {RESUME.contact.email}
            </a>
            <a href={`tel:${RESUME.contact.phone.replace(/\s/g, "")}`} className="hover:text-response">
              {RESUME.contact.phone}
            </a>
            <a
              href={`https://${RESUME.contact.github}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-response"
            >
              {RESUME.contact.github}
            </a>
          </p>

          <p className="mt-7 max-w-[68ch] leading-[1.65] text-ink-dim">
            {RESUME.summary}
          </p>

          <div className="print:hidden mt-8 flex flex-wrap gap-2">
            {pdfHref ? (
              <a
                href={pdfHref}
                download
                className="flex items-center gap-2 border border-response/45 bg-response/8 px-3 py-1.5 font-mono text-[11px] tracking-[0.16em] text-response uppercase transition-colors hover:border-response hover:bg-response/16 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response"
              >
                Download PDF ↓
              </a>
            ) : null}
            <PrintButton />
          </div>
        </header>

        <div className="mt-10 print:mt-6">
          <Section label="Experience">
            <ul className="space-y-4">
              {RESUME.experience.map((position) => (
                <li key={`${position.org}-${position.role}`}>
                  <p className="font-mono text-[14px] leading-snug text-ink">
                    {position.role}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-dim">
                    {position.org}
                    {position.note ? (
                      <span className="text-ink-faint"> · {position.note}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Selected work">
            <ul className="space-y-6">
              {RESUME.projects.map((project) => (
                <li key={project.name} className="print:break-inside-avoid">
                  <p className="flex flex-wrap items-baseline gap-x-3 font-mono text-[14px] leading-snug text-ink">
                    {project.name}
                    <span className="font-mono text-[11px] tracking-[0.1em] text-ink-faint">
                      {project.kind}
                    </span>
                  </p>
                  {project.href ? (
                    <a
                      href={project.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block font-mono text-[11px] text-response underline decoration-response/30 underline-offset-4"
                    >
                      {project.href.replace(/^https?:\/\/|\/$/g, "")}
                    </a>
                  ) : null}
                  <ul className="mt-2 space-y-1.5">
                    {project.points.map((point) => (
                      <li
                        key={point}
                        className="grid max-w-[68ch] grid-cols-[0.85rem_minmax(0,1fr)] text-[13px] leading-[1.6] text-ink-dim"
                      >
                        <span aria-hidden className="text-ink-faint">
                          —
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Skills">
            <dl className="space-y-3">
              {RESUME.skills.map((group) => (
                <div
                  key={group.label}
                  className="grid gap-x-4 gap-y-1 sm:grid-cols-[8rem_minmax(0,1fr)]"
                >
                  <dt className="font-mono text-[11px] tracking-[0.12em] text-ink-faint">
                    {group.label}
                  </dt>
                  <dd className="text-[13px] leading-[1.6] text-ink-dim">
                    {group.items.join(" · ")}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section label="Education">
            <p className="font-mono text-[14px] leading-snug text-ink">
              {RESUME.education.award}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-dim">
              {RESUME.education.institution}
              <span className="text-ink-faint"> · {RESUME.education.span}</span>
            </p>
            <p className="mt-2 text-[13px] leading-[1.6] text-ink-faint">
              Coursework: {RESUME.education.coursework.join(", ")}
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
