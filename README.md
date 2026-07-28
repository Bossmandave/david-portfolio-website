# David Uchenna Agodi — portfolio

A portfolio driven by a real PID control loop.

Nothing that **moves** on this site is eased by hand. There is not a single
`cubic-bezier()` in the codebase and no duration in the motion system — every element
that travels is a second-order system solved at runtime, and the visitor can retune it
until the interface goes unstable.

Opacity and colour fades still use ordinary CSS durations. A fade has no momentum to
model, and pretending otherwise would be dogma rather than engineering.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · raw WebGL2
**Runtime dependencies:** `next`, `react`, `react-dom`. That is the whole list.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Node 20+. Nothing else is required to run the site — the contact form is the only part
that needs configuration, and it degrades honestly without it.

| Script | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build. Runs the test suite first via `prebuild` |
| `npm start` | Serve the production build |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run lint` | ESLint |

**The test suite gates every build.** `prebuild` runs `vitest run`, so a red test means
no production bundle.

---

## The idea

Most portfolios claim engineering ability. This one runs an actual control system and
hands the visitor the gains.

A PID controller drives the interface. Its plant carries a constant load, which is the
only reason integral action has anything to do — without a disturbance to cancel, `ki`
contributes nothing but windup. The `/control` module exposes `kp`, `ki` and `kd` as
**Strength**, **Damping** and **Patience**, with the symbols as secondary annotation: a
recruiter reads the sentence, an engineer reads the Greek.

Take the damping out and the interface hunts for the pointer and keeps missing. Push it
too far and it rings again for a different reason. Both are the real dynamics, not an
animation of them.

There is a tuning target — settle inside 300 ms, under 5% overshoot, within 3 px of a
loaded setpoint. Each condition needs a different term, which is what makes it a control
problem rather than a slider puzzle. A solved tune encodes into the URL, so it can be
shared as a link.

**The challenge is verified winnable by a test.** A target nobody can reach is a bug,
not a difficulty setting, so `challenge.test.ts` drives the real system in Node and
asserts that a known-good tune passes and the default does not.

---

## Architecture

```
src/
├── core/        Zero React. Zero DOM. Pure TypeScript, fully unit-tested.
│   ├── control/     PID, second-order plant, closed-loop analysis, step metrics
│   ├── signal/      Ring buffer, frame statistics
│   ├── time/        Fixed-timestep clock
│   └── math/
├── engine/      React and browser bindings over core. Deliberately thin.
│   ├── runtime/     The single rAF loop, device tiering, media-query hooks
│   ├── gl/          WebGL2 field renderer and its React binding
│   ├── input/       Pointer tracking that never touches React state
│   ├── channel/     Batched CSS custom-property writes
│   └── transition/  Route transitions solved by the same solver
├── modules/     One directory per surface: boot, system, work, path, control, signal…
├── components/  Shared primitives and navigation
├── content/     Case studies, career path, résumé, contact — all typed data
├── lib/         Validation, rate limiting, form state
└── design/      Motion tokens
```

### Three rules the whole thing rests on

**One loop.** A single `requestAnimationFrame` for the entire application. Simulation
runs at a fixed 240 Hz so the controller behaves identically on a 60 Hz panel and a
144 Hz one; rendering happens once per frame. Components subscribe with `useSimulate`
and `useRender`.

**No re-renders in the hot path.** The loop writes to refs and to CSS custom properties
on `:root`. Any number of elements read `--sys-x`, `--sys-y` and `--sys-energy` in CSS
and move without React knowing anything happened. Redundant writes are cached away,
because setting a custom property to the value it already holds still costs a style
invalidation.

**One motion authority per property.** The control loop owns the system layer — ambient
depth, the cursor field, the tracked subject. Discrete UI transitions own theirs.
Nothing is driven by two things at once.

### Motion

`src/design/motion.ts` holds the entire motion system as ζ/ωₙ pairs:

| Token | ζ | Applied to |
| --- | --- | --- |
| `settle` | 1.00 | Toggles, state changes. Never overshoots |
| `commit` | 0.78 | Buttons. A trace of overshoot reads as confidence |
| `arrive` | 0.62 | Entrances. The hero lands on this |
| `drift` | 0.45 | Camera, ambient depth |
| `alert` | 0.30 | Errors. Rings visibly, used twice |

Duration is an **output** of the tuning, never an input — `settle` takes 182 ms and
`drift` takes 1.48 s because ζ and ωₙ say so, not because anyone chose those numbers.
The tokens are asserted in tests: retune `arrive` so its overshoot leaves the band
predicted by `exp(−πζ/√(1−ζ²))` and the suite fails.

**Reduced motion is a retune, not a stripped build.** Every token is recomputed at
ζ = 1 with a higher ωₙ — the system still runs and still settles, it simply never
overshoots. Accessibility expressed as a tuning decision rather than an exception path
with its own bugs.

---

## The WebGL field

The ambient background is a plant the control loop disturbs. How much the loop
overshoots decides how far a ripple travels before it dies, and how wide the standing
glow around the pointer blooms. Detune `/control` and the background detunes with it.

It is **raw WebGL2 with no dependencies** — a fullscreen triangle derived from
`gl_VertexID`, so there is no vertex buffer, no scene graph, and no 3D engine imported
to draw two triangles.

### Device tiers

| Tier | Trigger | Renders |
| --- | --- | --- |
| **0** | No WebGL2, `prefers-reduced-motion`, or Save-Data | CSS only. The site is complete here |
| **1** | Coarse pointer, < 4 GB, or < 4 cores | 50% buffer, 2 noise octaves |
| **2** | Desktop with headroom | 72% buffer, 4 octaves |

The decision is a pure function and is unit-tested. Two of its rules are judgement calls
worth knowing about: **preference beats capability** — reduced motion on a workstation
still gets tier 0, because that is a request rather than a limitation — and **withheld
hardware details are treated as adequate**, since Safari reports neither `deviceMemory`
nor a useful core count, and demoting every Apple device over a privacy decision would
be wrong.

The tier also **demotes at runtime**: 2.5 s of sustained p95 frame time above 22 ms
steps the device down. A machine that copes at rest can still cook once it is warm.

Every failure path falls back to the CSS field — no context, a driver that rejects the
shader, or a context lost mid-session.

---

## Content

Case studies, the career path and the résumé are **typed data**, never JSX. Swapping
placeholder content for real content means editing one file.

The `Metric` type carries a `caveat` field and the tests enforce it: **any ratio with a
denominator under 30 fails the build without one.** Small samples carry error bars wide
enough that quoting them bare misleads, and the type system is a better place to catch
that than review.

### The publication gate

```bash
STRICT_CONTENT=1 npm run build
```

Placeholder case studies describe work that does not exist, so shipping them would mean
presenting fabricated projects as real. Under `STRICT_CONTENT` the build **fails** and
names the offending slugs. Local and preview builds warn and pass.

> **Two case studies are currently placeholders** — `ai-streaming-interface` and
> `lysterpro`. They cannot be deployed until they are real.

---

## Configuration

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `CONTACT_WEBHOOK_URL` | Where the contact form posts. Any endpoint accepting a JSON POST of `{ name, email, message, receivedAt }` — Formspree and Web3Forms both work unmodified |

Leave it unset and the form **does not silently discard messages**: production returns
an error pointing at the mailbox, and development logs the payload to the server
console. A contact form that quietly drops mail is worse than no contact form, because
the sender leaves believing they reached someone.

Keep the real value in `.env.local`, not in `.env.example` — the template is meant to be
committed, and a public endpoint bypasses the server-side validation, honeypot and rate
limit entirely.

### Résumé PDF

Drop a file at `public/resume.pdf` and the download button appears on `/resume` at the
next build. Without it only the print action shows, because a download link that 404s
reads as a broken site rather than a missing file.

---

## Accessibility

- **Reduced motion** retunes the system rather than disabling it.
- **Full keyboard operation**, including the tuning panel and the career diagram, which
  implements the tablist pattern with arrow-key navigation.
- **Command palette** (`⌘K` / `Ctrl+K`) with combobox/listbox semantics,
  `aria-activedescendant`, focus trapping and focus restoration.
- **Errors are announced**, not merely coloured — a red border communicates nothing to a
  screen reader or a colourblind reader.
- **Route changes are announced**, since client-side navigation is otherwise silent to
  assistive technology.
- **The contact form works with JavaScript disabled.**
- Skip link, visible focus on every interactive element, and touch targets sized for
  fingers on coarse pointers while keeping the hairline look under a cursor.

---

## Testing

```bash
npm test
```

70 tests. The interesting ones are not coverage padding:

- The controller's step response is checked against `exp(−πζ/√(1−ζ²))`.
- The Routh–Hurwitz stability boundary is confirmed by simulation — a loop predicted
  unstable is asserted to actually diverge.
- Derivative kick is asserted present when differentiating error, absent when
  differentiating measurement.
- Anti-windup is asserted to reduce overshoot after a saturated push.
- The tuning challenge is asserted winnable, and asserted *not* won by the default.
- ζ is asserted **non-monotonic** in `kd` — a regression guard for a real bug where
  driving the shader with raw ζ made both ends of the slider look identical.

`core/` is pure TypeScript, which is why the control system can be tested at all.

---

## Routes

| Route | |
| --- | --- |
| `/` | System — hero, ambient loop, boot sequence |
| `/work` · `/work/[slug]` | Case studies |
| `/path` | Career as a signal chain |
| `/control` | The tunable loop |
| `/signal` | Contact |
| `/resume` | CV, print-styled |
| `/lab/control` | The full instrument — every knob, including the ones that break it |

---

## Deployment

Any host that runs Next.js. Set `CONTACT_WEBHOOK_URL` in the host's environment, and
`STRICT_CONTENT=1` on the production build so placeholder content cannot ship.

---

## Known gaps

Recorded here deliberately rather than left to be discovered:

- Two case studies are placeholders.
- Browser back/forward navigation does not animate — those changes bypass the click
  interceptor that drives transitions.
- Lighthouse has never been measured. The performance claims above are architectural
  reasoning, not evidence.
