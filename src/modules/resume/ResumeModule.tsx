"use client";

import { RESUME, type Position } from "@/content/resume";

/**
 * `as const` on the source gives every entry its own literal shape, so an optional field
 * only some of them carry — a location, a start date — is not reachable on the union.
 * Reading the list back through the declared type restores the optionality the interface
 * always intended, without giving up the literal checking on the data itself.
 */
const EXPERIENCE: readonly Position[] = RESUME.experience;

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

/**
 * A labelled band of the CV.
 *
 * On screen the label sits in a left gutter, which reads as an annotated document. In
 * print it collapses to a single column on purpose: a résumé parser walks the text in
 * document order, and a two-column grid is where a heading can end up interleaved with
 * the body of the section above it. Nothing about the printed copy is allowed to depend
 * on a machine reconstructing a layout.
 */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-x-10 gap-y-3 border-t border-line py-7 md:grid-cols-[9rem_minmax(0,1fr)] print:block print:break-inside-avoid print:py-4">
      <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase md:pt-1 print:mb-2 print:text-[11px] print:tracking-[0.16em] print:text-ink">
        {label}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/**
 * Bullets as a real list, rather than as a two-column grid with a dash in the gutter.
 *
 * The grid version looked identical and extracted badly: pulling text out of the PDF
 * gave the marker and the sentence as separate cells, so a parser counting achievements
 * saw a run of stray dashes and some orphaned prose. A `<ul>` costs nothing visually and
 * survives being read by something that is not a browser.
 */
function Points({ points }: { points: readonly string[] }) {
  return (
    <ul className="mt-2 max-w-[68ch] list-disc space-y-1.5 pl-4 text-[13px] leading-[1.6] text-ink-dim marker:text-ink-faint">
      {points.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
  );
}

function contactLinks() {
  const { email, phone, location, linkedin, github, portfolio } =
    RESUME.contact;

  const entries: Array<{ label: string; href?: string }> = [
    { label: location },
    { label: email, href: `mailto:${email}` },
    { label: phone, href: `tel:${phone.replace(/\s/g, "")}` },
    { label: linkedin, href: `https://${linkedin}` },
    { label: github, href: `https://${github}` },
    { label: portfolio, href: `https://${portfolio}` },
  ];

  // Anything not supplied is dropped rather than printed as an empty gap — a CV with a
  // blank where a link should be reads worse than one that never claimed to have it.
  return entries.filter((entry) => entry.label.trim().length > 0);
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
            {contactLinks().map((entry) =>
              entry.href ? (
                <a
                  key={entry.label}
                  href={entry.href}
                  className="hover:text-response"
                >
                  {entry.label}
                </a>
              ) : (
                <span key={entry.label}>{entry.label}</span>
              ),
            )}
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
          {/* The literal heading a parser looks for. "Selected work" and "Background"
              read better and match nothing. */}
          <Section label="Professional Experience">
            <ul className="space-y-6">
              {EXPERIENCE.map((position) => (
                <li
                  key={`${position.org}-${position.role}`}
                  className="print:break-inside-avoid"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <p className="font-mono text-[14px] leading-snug text-ink">
                      {position.role}
                      <span className="text-ink-dim"> · {position.org}</span>
                    </p>
                    {position.start ? (
                      <p className="font-mono text-[11px] tracking-[0.1em] text-ink-faint tabular-nums">
                        {position.start} — {position.end ?? "Present"}
                      </p>
                    ) : null}
                  </div>
                  {position.location ? (
                    <p className="mt-0.5 text-[12px] text-ink-faint">
                      {position.location}
                    </p>
                  ) : null}
                  <Points points={position.points} />
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Projects">
            <ul className="space-y-6">
              {RESUME.projects.map((project) => (
                <li key={project.name} className="print:break-inside-avoid">
                  <p className="font-mono text-[14px] leading-snug text-ink">
                    {project.name}
                    <span className="text-[11px] tracking-[0.1em] text-ink-faint">
                      {" "}
                      · {project.kind}
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
                  <Points points={project.points} />
                </li>
              ))}
            </ul>
          </Section>

          <Section label="Technical Skills">
            <dl className="space-y-3">
              {RESUME.skills.map((group) => (
                <div
                  key={group.label}
                  className="grid gap-x-4 gap-y-1 sm:grid-cols-[9rem_minmax(0,1fr)] print:block"
                >
                  <dt className="font-mono text-[11px] tracking-[0.12em] text-ink-faint">
                    {group.label}
                  </dt>
                  {/* Comma-separated, not middot-separated. A parser splitting a skills
                      line on commas is the common case; splitting on "·" is not. */}
                  <dd className="text-[13px] leading-[1.6] text-ink-dim">
                    {group.items.join(", ")}
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
              Relevant coursework: {RESUME.education.coursework.join(", ")}
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}
