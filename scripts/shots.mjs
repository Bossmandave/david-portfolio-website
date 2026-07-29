/**
 * Turns a folder of screenshots into `Shot` entries you can paste into a case study.
 *
 *   npm run shots face-recognition-door-access
 *
 * The only thing this does that you cannot do by hand is get `width` and `height` right,
 * which is exactly the field nobody gets right by hand — and the one that causes the
 * page to jump as it loads when it is wrong. `alt` and `caption` are left as TODOs
 * deliberately: they are the part that carries the argument, and a generator that
 * invented them would be writing the claims for you.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { intrinsicSize } from "./image-size.mjs";

const SUPPORTED = /\.(png|jpe?g)$/i;

const slug = process.argv[2];
if (!slug) {
  console.error("usage: npm run shots <project-slug>");
  console.error("       (the folder name under public/shots/)");
  process.exit(1);
}

const dir = join(process.cwd(), "public", "shots", slug);

let entries;
try {
  entries = readdirSync(dir);
} catch {
  console.error(`No such folder: public/shots/${slug}`);
  process.exit(1);
}

// Sorted by filename, which is why the naming convention starts with a number: the
// order screenshots appear in is an editorial decision, and it should live somewhere
// you can see it rather than in whatever order the filesystem hands them back.
const files = entries
  .filter((name) => SUPPORTED.test(name))
  .filter((name) => statSync(join(dir, name)).isFile())
  .sort();

if (files.length === 0) {
  console.error(`No .png/.jpg files in public/shots/${slug}`);
  const skipped = entries.filter(
    (name) => !SUPPORTED.test(name) && !name.startsWith("."),
  );
  if (skipped.length > 0) {
    console.error(`Ignored (unsupported format): ${skipped.join(", ")}`);
  }
  process.exit(1);
}

const lines = [];
for (const name of files) {
  const size = intrinsicSize(readFileSync(join(dir, name)));
  if (!size) {
    console.error(`Could not read dimensions from ${name} — is it really a PNG/JPEG?`);
    process.exit(1);
  }

  const orientation = size.width >= size.height ? "landscape" : "portrait";
  lines.push(
    [
      "    {",
      `      src: "/shots/${slug}/${name}",`,
      `      alt: "TODO — describe the screen for someone who cannot see it",`,
      `      caption: "TODO — what this is, and which part of it is yours",`,
      `      width: ${size.width},`,
      `      height: ${size.height},`,
      `    }, // ${orientation}, ${size.width}×${size.height}`,
    ].join("\n"),
  );
}

console.log(`  gallery: [\n${lines.join("\n")}\n  ],`);
console.error(
  `\n${files.length} shot(s) from public/shots/${slug}. ` +
    `Paste into the project in src/content/projects.ts and fill in the TODOs.\n` +
    `\`npm test\` will tell you if a file is missing, mistyped or the wrong size.`,
);
