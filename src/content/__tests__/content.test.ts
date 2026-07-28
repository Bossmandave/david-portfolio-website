import { describe, expect, it } from "vitest";

import { PROJECTS, getProject } from "@/content/projects";

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

  it("gives every real project a decision, a trade-off and a lesson", () => {
    for (const project of PROJECTS.filter((p) => !p.placeholder)) {
      // A case study missing any of these three is a feature list wearing a costume.
      expect(project.decisions.length, project.slug).toBeGreaterThan(0);
      expect(project.tradeoffs.length, project.slug).toBeGreaterThan(0);
      expect(project.lessons.length, project.slug).toBeGreaterThan(0);
      expect(project.role.length, project.slug).toBeGreaterThan(20);
    }
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
describe("publication gate", () => {
  const placeholders = PROJECTS.filter((project) => project.placeholder);

  it("refuses to pass with placeholder content when STRICT_CONTENT is set", () => {
    const strict =
      process.env.STRICT_CONTENT === "1" ||
      process.env.VERCEL_ENV === "production";

    if (!strict) {
      if (placeholders.length > 0) {
        console.warn(
          `\n  ⚠  ${placeholders.length} placeholder project(s) present: ` +
            `${placeholders.map((p) => p.slug).join(", ")}.` +
            `\n     Production builds with STRICT_CONTENT=1 will fail until these are real.\n`,
        );
      }
      return;
    }

    expect(
      placeholders.map((p) => p.slug),
      "placeholder projects cannot be published",
    ).toEqual([]);
  });
});
