# Screenshots

One folder per case study, named after its `slug` in `src/content/projects.ts`. Drop
image files in, run one command, paste the output. That's the whole workflow.

```
public/shots/
├── face-recognition-door-access/
├── branddrive-mobile/
├── nivram/
├── whitepenguin/
├── sanctuary-altar/
└── cw-real-estate/
```

## The three-step version

**1. Paste the files in.** Name them `01-`, `02-`, `03-` … in the order you want them to
appear, then a short description:

```
01-door-installed.jpg
02-enclosure-front.jpg
03-control-app.png
```

Keep whatever extension the file already has — `.png`, `.jpg` and `.jpeg` all work.
Nothing else does, and that is deliberate: those are the formats whose headers the
dimension check can read, and a format it cannot read is a check that silently passes.
(This is about the *source* file only. Next re-encodes to WebP/AVIF on the way out, so
storing PNGs costs your visitors nothing.)

**2. Run the generator.**

```bash
npm run shots face-recognition-door-access
```

It prints a ready-made `gallery: [...]` block with the real pixel dimensions of every
file already filled in.

**3. Paste that block into the project** in `src/content/projects.ts`, anywhere among the
other fields, and fill in the two TODOs per shot:

- **`alt`** — what the screen shows, for someone who cannot see it.
- **`caption`** — what this is, and *which part of it is yours*. This is the one that
  matters. A screenshot with no caption quietly claims every pixel in it; the caption is
  where the boundary gets said out loud.

Then `npm test`. It will tell you if a file is missing, misnamed, the wrong format, or
if a declared size has drifted from the file on disk.

## Why the dimensions are generated rather than typed

They are what lets the browser reserve the right-sized box before any image bytes
arrive. Get them wrong and the page shoves itself around as it loads, which is both the
worst thing you can do to someone reading and the easiest way to wreck a Lighthouse
score on a page that is otherwise static text.

Nobody types those correctly from memory, so nothing here asks you to.

## Where they show up

Detail pages only — `/work/<slug>`. The index stays typographic on purpose. A grid of
thumbnails there would turn a set of arguments into a set of pictures, and people would
start choosing by prettiest.

Tiles are capped by height rather than fitted to the column, so a portrait phone capture
and a wide desktop capture sit in the same band instead of one running past a full
screen. Click any of them for the full-size view: arrow keys page through, Escape
closes.

---

## Smart Home Security (`face-recognition-door-access`)

| File | What it is |
| --- | --- |
| `01-door-installed.png` | The rig mounted on the door frame — the finished thing |
| `02-enclosure-front.png` | Printed enclosure, powered, LCD reading "No Face Detected" |
| `03-control-app.png` | The dark web dashboard — recognition, enrol, lock, alarm, feed |
| `04-schematic.png` | The Proteus wiring diagram — Pi, relay, solenoid, LCD, LEDs |
| `05-enclosure-cad.png` | The Fusion 360 model with the front panel off |

Finished thing first, engineering underneath it second. Someone who reads no further
than the first tile should still have seen a door that opens to a face.

The auth screens are deliberately not here. They are the least distinctive part of the
build — every project has a login page — and the case study is stronger spending its
tiles on the parts nobody else has.
