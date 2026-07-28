import type { Project } from "@/content/types";

/**
 * The real one. Numbers here are taken from the project report and corrected where the
 * report's own arithmetic disagreed with its raw counts — see `outcomes` caveats.
 */
const doorAccess: Project = {
  slug: "face-recognition-door-access",
  title: "Face-Recognition Door Access",
  summary:
    "A door lock that opens to a face, controlled from a browser anywhere — recognition running on the device, not in a cloud.",
  year: "2025",
  domains: ["mechatronics", "embedded", "frontend", "ai"],

  role: "Sole engineer. Component selection, embedded Python on the Raspberry Pi, the Flask control API, the React control app, and the 3D-printed enclosure. Final-year B.Eng project, Afe Babalola University, supervised by Engr. Dr. A. Akinwumi.",

  problem:
    "Keys and passcodes can be copied, shared or stolen, and none of them leave a record of who came through the door. The published Raspberry Pi attempts at solving this split into two camps: those running recognition on hardware too weak for it — ESP32-CAM boards that could not hold real time — and those with adequate compute but no remote control path at all. Nobody had both, and both were the requirement.",

  constraints: [
    "A single Raspberry Pi 4 as the only compute. Recognition had to run on-device — no cloud inference budget and no appetite for shipping faces off the box.",
    "₦158,640 total component budget, which fixed the camera, the lock and the board before any code was written.",
    "The door had to work with the internet down. A house whose lock depends on connectivity is worse than a key.",
    "12V/0.35A solenoid against 3.3V GPIO — the actuator could not be driven directly and needed relay isolation.",
    "One fixed camera, no controlled lighting: the same doorway in Nigerian afternoon sun and in a dim hallway.",
    "Frontend on Vercel, backend on a Raspberry Pi behind a tunnel — a cross-origin split with a device that has no stable public address.",
  ],

  decisions: [
    {
      title: "Two trigger paths into one recognition function",
      body: "A physical button on the enclosure and a remote API endpoint both call the same internal routine. The local path needs no network at all, so a dropped connection degrades the system to exactly what it was before — a door you walk up to — rather than to a locked box.",
    },
    {
      title: "Recognition on-device, at a 0.40 distance threshold",
      body: "128-dimensional encodings compared locally rather than sent to a hosted model. That removes network round-trip from the critical path, removes a privacy problem, and removes an availability dependency. The threshold is deliberately tight — the consequences of the two error directions are not symmetric.",
    },
    {
      title: "Enrollment averages several images into one encoding",
      body: "Rather than storing every enrollment photo and matching against all of them, the encodings are averaged into a single vector per person. It costs some per-image precision and buys robustness across the lighting the doorway actually sees.",
    },
    {
      title: "MJPEG in a plain <img> tag for the live feed",
      body: "WebRTC would have been lower latency and would also have required a signalling server, TURN fallback and a pile of client state. A multipart JPEG stream renders in an ordinary image tag with no client-side code at all. For deciding whether to open a door, the latency difference does not matter; the complexity difference does.",
    },
    {
      title: "Auto-lock as a deadline watched by a background thread",
      body: "The unlock handler sets an expiry timestamp and returns immediately; a separate thread re-engages the lock when the deadline passes. Sleeping inside the request would have held the response open for five seconds and, worse, would have left the door open permanently if the request died mid-sleep.",
    },
  ],

  tradeoffs: [
    {
      gave: "20% of authorized attempts fail in low light and have to be retried",
      got: "Recognition that never leaves the device — no cloud latency, no per-request cost, and no face data in anyone else's datacentre",
    },
    {
      gave: "One in four authorized attempts rejected on first try at the 0.40 threshold",
      got: "A bias toward refusing the right person over admitting the wrong one. For a lock, a retry is an annoyance and a false accept is a break-in.",
    },
    {
      gave: "Bandwidth, and no audio channel",
      got: "A live video feed that worked in a single <img> tag with zero client-side streaming code",
    },
    {
      gave: "GPIO interrupt handlers had to be torn down and re-registered around every actuation",
      got: "A button that could not double-fire mid-unlock. This was the bug that took longest to find: two threads, one hardware resource, and a failure that only appeared under the multi-worker API setup.",
    },
  ],

  outcomes: [
    { label: "Face match", value: "1.3 s", caveat: "on-device, Raspberry Pi 4" },
    { label: "Remote unlock", value: "800 ms", caveat: "end-to-end, browser to bolt" },
    { label: "Recognition — daylight", value: "47 / 50" },
    { label: "Recognition — low light", value: "40 / 50" },
    { label: "Unknown correctly refused", value: "29 / 30" },
    {
      label: "False accepts",
      value: "2 of 20",
      caveat:
        "Small sample and a prototype threshold. This is the number that says the system is not production-ready, and it is the first thing I would attack.",
    },
    {
      label: "False rejects",
      value: "5 of 20",
      caveat: "Deliberate — the direction the threshold was tuned toward",
    },
    { label: "Lock actuation", value: "50+ cycles, 0 failures" },
    { label: "Bill of materials", value: "₦158,640" },
  ],

  lessons: [
    "Credentials were written to Firestore in plaintext alongside Firebase Auth, which was already hashing and storing them properly. Two sources of truth for a password is one too many, and the weaker one sets the security of the system. It should never have been written.",
    "There is no liveness check. A printed photograph held up to the camera passes. Single-camera face recognition without depth or blink detection is an access convenience, not an access control, and the report should have said so more plainly than it did.",
    "The published false-accept and false-reject figures were percentages computed a hundred times too small — 2 of 20 is 10%, not 0.1%. Nobody caught it before submission. Small numbers that flatter you deserve more scrutiny than large ones, not less.",
  ],

  stack: [
    "React",
    "Tailwind CSS",
    "Framer Motion",
    "Firebase Auth",
    "Cloud Firestore",
    "Vercel",
    "Python",
    "Flask",
    "OpenCV",
    "face_recognition",
    "Raspberry Pi 4",
    "Fusion 360",
  ],

  links: [],
};

/* ------------------------------------------------------------------------------------
 * Placeholders.
 *
 * Deliberately uneven — different constraint counts, one with a hard number and one
 * without, different section lengths. Tidy placeholders produce a layout that real
 * content breaks; these are shaped like the messy thing they will be replaced by.
 * ---------------------------------------------------------------------------------- */

const streamingInterface: Project = {
  slug: "ai-streaming-interface",
  title: "AI Streaming Interface",
  summary:
    "Placeholder — an AI feature rebuilt to render tokens as they arrive instead of waiting for the whole response.",
  year: "2025",
  domains: ["frontend", "ai"],
  placeholder: true,

  role: "PLACEHOLDER — state the scope boundary here: which parts were owned and which belonged to the platform team.",

  problem:
    "PLACEHOLDER — the existing implementation waited for a complete response before rendering anything, so long generations read as a hung interface. Needs the actual wait time before the change.",

  constraints: [
    "PLACEHOLDER — production codebase, could not break existing behaviour",
    "PLACEHOLDER — fixed backend contract, no API changes available",
    "PLACEHOLDER — had to work within existing auth and state management",
  ],

  decisions: [
    {
      title: "PLACEHOLDER — transport choice",
      body: "Server-sent events or fetch streams? This needs answering before the case study can be written; it is the first question a technical reader asks.",
    },
    {
      title: "PLACEHOLDER — how partial markdown was rendered mid-stream",
      body: "Unclosed code fences and half-written tables are the hard part of streaming markdown. Whatever was done here is the interesting content.",
    },
  ],

  tradeoffs: [
    {
      gave: "PLACEHOLDER — significantly more complex state and error handling; a stream can fail halfway",
      got: "PLACEHOLDER — perceived responsiveness; needs the measured before/after",
    },
  ],

  outcomes: [
    {
      label: "PLACEHOLDER — time to first token",
      value: "— ms",
      caveat: "Needs measuring. Estimate honestly and label it an estimate.",
    },
  ],

  lessons: ["PLACEHOLDER — what would be done differently."],
  stack: ["React", "Next.js", "TypeScript", "Tailwind CSS"],
  links: [
    { label: "Private repository", href: "#", private: true },
    { label: "Internal product", href: "#", private: true },
  ],
};

/**
 * The factual shell is real — title, stack and live URL come from the résumé. The
 * analysis is not, and is marked as such: constraints, the decision that could have
 * gone the other way, and what it cost are the parts only the author can supply.
 */
const lysterPro: Project = {
  slug: "lysterpro",
  title: "LysterPro",
  summary:
    "A job board where employers post and applicants track — placeholder until the engineering decisions behind it are written up.",
  year: "2025",
  domains: ["frontend"],
  placeholder: true,

  role: "PLACEHOLDER — was this solo or a team? Which parts were owned?",

  problem:
    "PLACEHOLDER — a job board is a well-trodden shape, so the problem statement has to say what was specifically wrong with the alternatives, or why building rather than buying was the right call.",

  constraints: [
    "PLACEHOLDER — timeline and team size",
    "PLACEHOLDER — what the data model had to support",
  ],

  decisions: [
    {
      title: "PLACEHOLDER — React Query over manual fetching",
      body: "The résumé says React Query handled fetching and synchronisation across user and listing data. What went wrong with the naive approach first? Cache invalidation on application submit, or refetch storms on the listing page, are the kinds of specifics that make this a decision rather than a library choice.",
    },
    {
      title: "PLACEHOLDER — how application state was modelled",
      body: "Two roles seeing different views of the same record is the interesting part of any marketplace. Whatever that looked like is the case study.",
    },
  ],

  tradeoffs: [
    { gave: "PLACEHOLDER", got: "PLACEHOLDER" },
  ],

  outcomes: [],
  lessons: ["PLACEHOLDER — what would be done differently."],

  stack: [
    "React",
    "Tailwind CSS",
    "React Query",
    "React Hook Form",
    "Vercel",
  ],

  links: [{ label: "lysterpro.vercel.app", href: "https://lysterpro.vercel.app/" }],
};

export const PROJECTS: Project[] = [doorAccess, streamingInterface, lysterPro];

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((project) => project.slug === slug);
}

export const REAL_PROJECTS = PROJECTS.filter((project) => !project.placeholder);
