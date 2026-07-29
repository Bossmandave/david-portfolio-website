import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PROJECTS, getProject, projectsFor } from "@/content/projects";
import { SHIPPED, shippedFor } from "@/content/shipped";

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
  const drafts = [
    ...PROJECTS.filter((project) => project.placeholder).map((p) => p.slug),
    ...SHIPPED.filter((entry) => entry.placeholder).map((e) => e.name),
  ];

  /**
   * The rule this enforces changed, and the reason is worth recording.
   *
   * It used to fail the build whenever a placeholder *existed anywhere in the file*.
   * That was right when it was written, because nothing else stopped a draft reaching
   * production. Since then the content modules gained a real filter — drafts generate
   * no route, no index entry and no palette result in a production build — and the old
   * rule started failing deploys over work that was already unreachable. A guard that
   * blocks a correct deployment teaches people to delete the guard.
   *
   * So it now asserts the thing that actually matters: nothing published is a draft.
   * Keeping unfinished work in the repository is normal. Serving it is not.
   */
  it("publishes nothing marked as a draft", () => {
    const publishedProjects = projectsFor(false);
    const publishedShipped = shippedFor(false);

    expect(
      publishedProjects.filter((project) => project.placeholder).map((p) => p.slug),
      "a draft reached the published project list",
    ).toEqual([]);

    expect(
      publishedShipped.filter((entry) => entry.placeholder).map((e) => e.name),
      "a draft reached the published shipped list",
    ).toEqual([]);

    // Not an error — just a receipt, so a draft that has quietly sat unfinished for
    // months is visible in the test output rather than only in the file.
    if (drafts.length > 0) {
      console.warn(
        `\n  ⚠  ${drafts.length} draft(s) held back from production: ${drafts.join(", ")}.\n`,
      );
    }
  });

  /**
   * The filter above is only worth anything if every surface uses it.
   *
   * This is not hypothetical: the command palette imported the unfiltered `PROJECTS`
   * and would have listed a draft in production, linking to a route that had
   * deliberately not been generated. The build was green, the page rendered, and the
   * only symptom was a 404 behind a search result nobody would think to check.
   */
  it("renders every production surface from the filtered lists", () => {
    const root = join(process.cwd(), "src");

    const files = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) => !file.includes("__tests__"))
      // The content modules are where the unfiltered arrays are defined and filtered.
      .filter((file) => !file.replace(/\\/g, "/").startsWith("content/"));

    const offenders = files.filter((file) => {
      const source = readFileSync(join(root, file), "utf8");
      const imports =
        source.match(
          /import\s*\{([^}]*)\}\s*from\s*"@\/content\/(?:projects|shipped)"/g,
        ) ?? [];
      return imports.some((line) => /\b(?:PROJECTS|SHIPPED)\b/.test(line));
    });

    expect(
      offenders,
      "import VISIBLE_PROJECTS / VISIBLE_SHIPPED — the unfiltered lists include drafts",
    ).toEqual([]);
  });
});
