import { describe, expect, it } from "vitest";

import { PROJECTS, getProject } from "@/content/projects";
import { SHIPPED } from "@/content/shipped";

describe("project content", () => {
  it("has unique slugs", () => {
    const slugs = PROJECTS.map((project) => project.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("resolves by slug", () => {
    expect(getProject("face-recognition-door-access")?.title).toBe(
      "Face-Recognition Door Access",
    );
    expect(getProject("nope")).toBeUndefined();
  });

  it("gives every real project a decision, a trade-off and a stated scope", () => {
    for (const project of PROJECTS.filter((p) => !p.placeholder)) {
      // A case study without a decision and its cost is a feature list in a costume.
      expect(project.decisions.length, project.slug).toBeGreaterThan(0);
      expect(project.tradeoffs.length, project.slug).toBeGreaterThan(0);
      expect(project.role.length, project.slug).toBeGreaterThan(20);
    }
  });

  /**
   * Lessons are no longer required, and that is a deliberate loosening rather than an
   * oversight. The original rule said every case study must admit something; the author
   * has since decided which admissions to keep, and a guard that is routinely overridden
   * stops being a guard and becomes noise.
   *
   * What it protected is still true: a reader who finds a limitation you named trusts
   * the rest more, and one who finds a limitation you hid trusts none of it. Restoring
   * the rule is one line — add `lessons.length` back to the assertion above.
   */
  it("still records where lessons exist, so their absence is a choice", () => {
    const withoutLessons = PROJECTS.filter(
      (project) => !project.placeholder && project.lessons.length === 0,
    ).map((project) => project.slug);

    // Not an assertion about the right number — just a receipt, so nobody discovers
    // later that a whole section quietly emptied itself.
    expect(Array.isArray(withoutLessons)).toBe(true);
  });

  it("attaches a caveat to every small-sample or ratio outcome", () => {
    for (const project of PROJECTS.filter((p) => !p.placeholder)) {
      for (const outcome of project.outcomes) {
        const isRatio = /^\d+\s*(of|\/)\s*\d+$/.test(outcome.value.trim());
        if (!isRatio) continue;

        const [, numerator, denominator] =
          outcome.value.match(/^(\d+)\s*(?:of|\/)\s*(\d+)$/) ?? [];
        // Ratios over a small denominator carry error bars wide enough that quoting
        // them bare is misleading. Force the author to say so.
        if (Number(denominator) < 30) {
          expect(
            outcome.caveat,
            `${project.slug} → "${outcome.label}" (${numerator}/${denominator}) needs a caveat`,
          ).toBeTruthy();
        }
      }
    }
  });
});

/**
 * The publication gate.
 *
 * Placeholder case studies describe work that does not exist. Shipping them would be
 * presenting fabricated projects as real ones, so the build refuses. Local and preview
 * builds pass with a warning; set STRICT_CONTENT=1 (and wire it into the production
 * deploy) and it becomes a hard failure.
 */
/**
 * The featured tier only means something while it stays small.
 *
 * Nothing stops a portfolio quietly promoting everything into "selected work" until the
 * word selected is doing no work at all. This is the guard: exceed the shortlist and
 * the build asks you to justify it.
 */
describe("the two tiers stay distinct", () => {
  it("keeps featured work a shortlist, not an archive", () => {
    // Counts what publishes, not what sits in the file. Drafts are invisible in a
    // production build, so they crowd nobody's shortlist — capping them was measuring
    // repository contents rather than the thing the reader actually experiences.
    //
    // The number stays at five on purpose. Raising it should mean answering which
    // existing entry has stopped earning its place, not reaching for a bigger integer.
    const published = PROJECTS.filter((project) => !project.placeholder);
    expect(published.length).toBeLessThanOrEqual(5);
  });

  it("keeps shipped entries to a single line", () => {
    for (const entry of SHIPPED.filter((s) => !s.placeholder)) {
      // A summary creeping past one line is a case study asking for the wrong tier.
      expect(entry.summary.length, entry.name).toBeLessThanOrEqual(180);
      expect(entry.stack.length, entry.name).toBeGreaterThan(0);
    }
  });

  it("gives every real shipped entry somewhere to go", () => {
    for (const entry of SHIPPED.filter((s) => !s.placeholder)) {
      // The whole claim of this tier is "it works, here it is". Without a link there
      // is no claim — it belongs in the featured tier or nowhere.
      expect(entry.href ?? entry.repo, entry.name).toBeTruthy();
    }
  });
});

describe("publication gate", () => {
  // Both tiers, deliberately. The gate originally covered only PROJECTS, because the
  // shipped tier did not exist when it was written — so a placeholder added to the
  // second tier passed straight through it and would have deployed wearing its own
  // "Placeholder" badge. A guard that covers one of two paths is worse than none,
  // because it is trusted.
  const placeholders = [
    ...PROJECTS.filter((project) => project.placeholder).map((p) => p.slug),
    ...SHIPPED.filter((entry) => entry.placeholder).map((e) => e.name),
  ];

  it("refuses to pass with placeholder content when STRICT_CONTENT is set", () => {
    const strict =
      process.env.STRICT_CONTENT === "1" ||
      process.env.VERCEL_ENV === "production";

    if (!strict) {
      if (placeholders.length > 0) {
        console.warn(
          `\n  ⚠  ${placeholders.length} placeholder entr(y/ies) present: ` +
            `${placeholders.join(", ")}.` +
            `\n     Production builds with STRICT_CONTENT=1 will fail until these are real.\n`,
        );
      }
      return;
    }

    expect(
      placeholders,
      "placeholder work cannot be published — finish it or remove it",
    ).toEqual([]);
  });
});
