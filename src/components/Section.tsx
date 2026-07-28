import type { ReactNode } from "react";

/**
 * A labelled band of a case study.
 *
 * The label sits in a left gutter on wide screens and collapses above the content on
 * narrow ones — so the page reads as an annotated document rather than a stack of
 * headed blocks, and the annotation never costs the prose its measure.
 */
export function Section({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`grid gap-x-12 gap-y-4 border-t border-line py-10 md:grid-cols-[8rem_minmax(0,1fr)] ${className}`}
    >
      <h2 className="font-mono text-[10px] tracking-[0.22em] text-ink-faint uppercase md:pt-1">
        {label}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
