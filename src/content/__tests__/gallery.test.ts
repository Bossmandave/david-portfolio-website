import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { intrinsicSize } from "../../../scripts/image-size.mjs";
import { PROJECTS } from "@/content/projects";
import type { Shot } from "@/content/types";

const PUBLIC_DIR = join(process.cwd(), "public");

const ALL_SHOTS: Array<{ slug: string; index: number; shot: Shot }> =
  PROJECTS.flatMap((project) =>
    (project.gallery ?? []).map((shot, index) => ({
      slug: project.slug,
      index,
      shot,
    })),
  );

/** Where a shot lives on disk. `src` is a URL path, so it is always POSIX-shaped. */
function fileFor(shot: Shot): string {
  return join(PUBLIC_DIR, shot.src.replace(/^\//, ""));
}

/**
 * The gallery is the part of a portfolio that fails silently.
 *
 * Prose that is wrong gets read and questioned. A screenshot whose file was renamed
 * renders as a broken icon, a screenshot whose declared size is stale shoves the whole
 * page down as it loads, and neither shows up in a build log. These run on every commit
 * so that the failure is a red test rather than something a recruiter finds first.
 */
describe("gallery assets", () => {
  it("points every screenshot at a file that exists", () => {
    for (const { slug, index, shot } of ALL_SHOTS) {
      expect(
        existsSync(fileFor(shot)),
        `${slug} → shot ${index + 1} references ${shot.src}, which is not in public/`,
      ).toBe(true);
    }
  });

  it("stores screenshots as PNG or JPEG, so their size can be verified", () => {
    for (const { slug, index, shot } of ALL_SHOTS) {
      // Not a delivery-format decision — Next re-encodes to WebP/AVIF on the way out.
      // This is about the source file being one whose header this test can read. A
      // format it cannot read is a dimension check that silently does nothing.
      expect(
        /\.(png|jpe?g)$/i.test(shot.src),
        `${slug} → shot ${index + 1} (${shot.src}) must be .png, .jpg or .jpeg`,
      ).toBe(true);
    }
  });

  it("matches every declared size to the file on disk", () => {
    for (const { slug, index, shot } of ALL_SHOTS) {
      const path = fileFor(shot);
      if (!existsSync(path)) continue; // Already reported by the test above.

      const real = intrinsicSize(readFileSync(path));
      expect(
        real,
        `${slug} → shot ${index + 1}: could not read dimensions from ${shot.src}`,
      ).not.toBeNull();

      expect(
        { width: real?.width, height: real?.height },
        `${slug} → shot ${index + 1} (${shot.src}) declares ${shot.width}×${shot.height}`,
      ).toEqual({ width: shot.width, height: shot.height });
    }
  });

  it("gives every screenshot an alt and a caption that do the same job once", () => {
    for (const { slug, index, shot } of ALL_SHOTS) {
      const where = `${slug} → shot ${index + 1}`;

      expect(shot.alt.trim().length, `${where} needs alt text`).toBeGreaterThan(
        0,
      );
      // A caption is what makes the screenshot evidence rather than decoration, and
      // one word cannot say what a screen is and where the author's boundary was.
      expect(
        shot.caption.trim().length,
        `${where} needs a caption saying what this is and which part is yours`,
      ).toBeGreaterThan(20);

      // The caption is visible text. Duplicating it into alt means a screen-reader user
      // hears the same sentence twice and learns nothing from the image.
      expect(
        shot.alt.trim().toLowerCase(),
        `${where}: alt duplicates the caption — describe the screen instead`,
      ).not.toBe(shot.caption.trim().toLowerCase());
    }
  });

  it("does not show the same screenshot twice in one gallery", () => {
    for (const project of PROJECTS) {
      const sources = (project.gallery ?? []).map((shot) => shot.src);
      expect(new Set(sources).size, project.slug).toBe(sources.length);
    }
  });
});
