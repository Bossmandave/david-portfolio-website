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

  // Finished thing first, engineering underneath it second. Someone who looks at one
  // tile and leaves should still have seen a door that opens to a face; build order
  // would have led with a wiring diagram and read as a lab notebook.
  gallery: [
    {
      src: "/shots/face-recognition-door-access/01-door-installed.png",
      alt: "The completed unit mounted on a door frame — an orange enclosure on the jamb beside a full-size black door",
      caption:
        "The finished rig, mounted and running. One fixed camera at one height in a real doorway — the conditions every number further down this page was measured in.",
      width: 567,
      height: 756,
    },
    {
      src: "/shots/face-recognition-door-access/02-enclosure-front.png",
      alt: "Front face of the printed enclosure, powered: camera at the top, a blue character LCD reading No Face Detected, three status LEDs with the red one lit, and a red push button",
      caption:
        "Idle. The display and the three LEDs report what the Pi is doing without anyone reaching for a phone, and the button under them is the local trigger — the path that still works with the internet down.",
      width: 514,
      height: 685,
    },
    {
      src: "/shots/face-recognition-door-access/03-control-app.png",
      alt: "Dark-themed web dashboard headed Remote Security System, with panels for facial recognition, face enrollment, door lock control, alarm control, a live video feed, user management and access logs",
      caption:
        "The remote half. Recognition, enrolment, lock, alarm and the MJPEG feed on one screen, talking to the Flask API on the Pi through a tunnel.",
      width: 743,
      height: 443,
    },
    {
      src: "/shots/face-recognition-door-access/04-schematic.png",
      alt: "Proteus schematic wiring a Raspberry Pi 4 to an I2C character LCD, three LEDs, a buzzer, a single-channel relay module and a 12V solenoid",
      caption:
        "The relay in the middle is the reason this diagram exists: a 12V solenoid cannot be driven from a 3.3V GPIO pin, so the Pi switches it rather than powering it.",
      width: 735,
      height: 433,
    },
    {
      src: "/shots/face-recognition-door-access/05-enclosure-cad.png",
      alt: "Fusion 360 model of the enclosure with the front panel lifted away, showing internal standoffs, a shelf and cutouts for the camera, display, LEDs and button",
      caption:
        "Fusion 360, before printing. The cutouts are sized to parts the budget had already fixed — the camera, the display and the board were bought before the box was drawn.",
      width: 465,
      height: 647,
    },
  ],

  role: "Sole engineer. Component selection, embedded Python on the Raspberry Pi, the Flask control API, the React control app, and the 3D-printed enclosure. Final-year B.Eng project, Afe Babalola University, supervised by Engr. Dr. A. Akinwumi.",

  problem:
    "Keys and passcodes can be copied, shared or stolen, and none of them leave a record of who came through the door. The published Raspberry Pi attempts at solving this split into two camps: those running recognition on hardware too weak for it — ESP32-CAM boards that could not hold real time — and those with adequate compute but no remote control path at all. Nobody had both, and both were the requirement.",

  constraints: [
    "A single Raspberry Pi 4 as the only compute. Recognition had to run on-device — no cloud inference budget and no appetite for shipping faces off the box.",
    "₦350,000 total budget, which fixed the camera, the lock and the board before any code was written.",
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
    { label: "Total project cost", value: "₦350,000" },
  ],

  lessons: [
    "Credentials were written to Firestore in plaintext alongside Firebase Auth, which was already hashing and storing them properly. Two sources of truth for a password is one too many, and the weaker one sets the security of the system. It should never have been written.",
    "There is no liveness check. A printed photograph held up to the camera passes. Single-camera face recognition without depth or blink detection is an access convenience, not an access control, and the report should have said so more plainly than it did.",
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

/**
 * The companion to the Nivram study, deliberately separate. That one is about the AI
 * layer; this is about the app underneath it. Splitting them keeps each making one
 * argument — and the scope statement says plainly that they are the same product, so
 * nobody reads two entries as twice the work.
 */
const brandDriveMobile: Project = {
  slug: "branddrive-mobile",
  title: "BrandDrive mobile",
  summary:
    "The half of an app nobody demos — theming, sheets that survive Android's keyboard, a lock that engages when you background it — plus the money screens where the empty state matters more than the happy path.",
  year: "2026",
  domains: ["frontend"],

  // The first two tiles are the same product in both schemes, deliberately adjacent.
  // The theming decision is the headline claim of this study and it is the one claim a
  // single screenshot cannot make — you have to be able to see the pair.
  gallery: [
    {
      src: "/shots/branddrive-mobile/01-dashboard-dark.png",
      alt: "Business home screen in dark theme: greeting, an Ask Nivram entry point, quick actions for invoices, expenses, customers and point of sale, a balance card and a list of today's priorities",
      caption:
        "Dark. Read it against the next tile: the theme is a set of custom properties swapped on a plain container, because React Native could not be trusted to honour the platform's own colour scheme. The Nivram entry point here belongs to its own case study.",
      width: 499,
      height: 1080,
    },
    {
      src: "/shots/branddrive-mobile/02-menu-light.png",
      alt: "Business tools menu in light theme, with tabs for bookkeeping, finance, reports and compliance above a grid of tools including sales, customers, invoicing, point of sale, products and vendors",
      caption:
        "Light. Getting here in a twelve-person codebase meant retrofitting every screen that already existed, not just theming new ones. The rule that holds it together: the variables live on a plain container, never an animated one — a distinction nothing in the framework warns you about.",
      width: 499,
      height: 1080,
    },
    {
      src: "/shots/branddrive-mobile/03-invoicing.png",
      alt: "Invoicing list showing totals for open and overdue invoices above cards for individual invoices with their amount, date and paid or overdue status",
      caption:
        "Invoicing, populated. The two totals at the top are the screen's actual job — an owner opens this to find out what is outstanding, not to read a list.",
      width: 499,
      height: 1080,
    },
    {
      src: "/shots/branddrive-mobile/04-create-invoice.png",
      alt: "Create-invoice wizard on the details step, with tabs for details, items, payment and review above fields for invoice number, title, customer, business branch and currency",
      caption:
        "Four steps, and the state has to survive all of them — plus an Android keyboard opening over an item sheet, plus the user abandoning it halfway and coming back. The most ordinary-looking thing I own and the one with the most edges.",
      width: 499,
      height: 1080,
    },
    {
      src: "/shots/branddrive-mobile/05-account-security.png",
      alt: "My Account screen listing personal details, wallet control, change passcode, passkey, device management, payment security and a Face ID toggle",
      caption:
        "Where the lock lives. It engages when the app returns to the foreground rather than at startup — a finance app left open on a desk is the moment that matters — and each of the three biometric failure modes gets its own way back to a passcode instead of one catch that strands you outside your own account.",
      width: 499,
      height: 1080,
    },
    {
      src: "/shots/branddrive-mobile/06-transfers.png",
      alt: "Transfers screen in dark theme with a balance card, bank and account details, a daily limit bar showing used and remaining amounts, send and add money actions, and a list of recent transactions",
      caption:
        "Transfers. I reworked both the interface and the internal logic here on top of an existing design — refinement rather than origination, which is a real contribution and worth naming as the one it is.",
      width: 499,
      height: 1080,
    },
  ],

  role: "Around a hundred and eleven commits on BrandDrive's Expo app, outside the Nivram module that has its own case study — the same product, a different layer of it. I introduced the theming system, the Android keyboard behaviour for sheets and pickers, the app-lock overlay and biometric paths, the invoicing flow end to end, the personal home screen, and credit notes. I did not originate transfers, the permission gate or the wallet hook: on transfers I reworked the interface and the internal logic over an existing design, and on the other two I wired call sites and fixed failures without designing them.",

  problem:
    "A finance app for small businesses is judged on the screens nobody puts in a product tour. Whether a bottom sheet is reachable when Android's keyboard and its navigation bar are both on screen. Whether the app locks when it goes to the background, and what happens when the fingerprint reader refuses. Whether the dashboard is comprehensible to somebody who has not created a wallet yet. None of that appears on a feature list, and all of it is what the app feels like to use every morning.",

  constraints: [
    "React Native does not reliably honour `Appearance.setColorScheme`, so a theme could not simply be told to the platform and left alone.",
    "Android's three-button navigation bar, the software keyboard and a bottom sheet all compete for the same edge of the screen, and the sheet library's defaults do not account for the combination.",
    "A twelve-person codebase where the design language changed under me, so themes had to land across every existing screen rather than only new ones.",
  ],

  decisions: [
    {
      title: "Theme by swapping CSS variables on an ordinary View",
      body: "Because the platform's own colour-scheme switch could not be trusted, the theme is a set of custom properties swapped on a plain container rather than a mode handed to the system. The trap that cost the most time: putting those variables on an animated container silently breaks the light defaults — nothing errors, the app simply renders wrong in one scheme and correctly in the other, which is the hardest class of bug to notice and the easiest to reintroduce.",
    },
    {
      title: "Sheets that measure the phone rather than assume it",
      body: "A bottom sheet with a text field in it has to sit above the keyboard, above the navigation bar, and above the navigation bar when it is the three-button kind — which occupies space the gesture-bar layout does not. The library's defaults handle the common case and leave the rest to the app, so modals, dropdowns and date pickers respond to the measured geometry instead of a constant that happens to be right on the reviewer's device.",
    },
    {
      title: "The lock is a resume behaviour, not a login screen",
      body: "Locking engages when the app returns to the foreground rather than at startup, which is the moment that actually matters — a finance app left open on a desk. Biometrics have three distinct failure modes that a user experiences identically, so each has its own path back to a passcode rather than a single catch that leaves them stuck outside their own account.",
    },
    {
      title: "The empty states are the screen",
      body: "The personal home was built around the cases where there is nothing to show: no wallet created, no transaction PIN set, a balance below zero. A dashboard designed for the populated case and patched afterwards puts its worst experience in front of every new user on their first morning, which is the one impression that cannot be revised.",
    },
    {
      title: "Invoicing as a wizard that survives being left",
      body: "Create, add items, send, then record payment against it later — with recurring invoices reusing the same path rather than forking it. The state has to hold across steps, across an Android keyboard opening over an item sheet, and across the user abandoning it halfway. It is the most ordinary-looking feature I own and the one with the most edges.",
    },
  ],

  tradeoffs: [
    {
      gave: "Letting the platform own the colour scheme",
      got: "A theme that actually applies, at the cost of a rule every future contributor has to know — variables belong on a plain container, and nothing warns you when they are not",
    },
    {
      gave: "The sheet library's default insets",
      got: "Sheets that stay usable on Android hardware the team does not carry — three-button navigation is a setting, not a device generation, and it is invisible until somebody complains",
    },
    {
      gave: "Shipping the dashboard on its populated case first",
      got: "A first-run experience that reads as designed rather than unfinished. Empty states built last are always built worst.",
    },
  ],

  alsoBuilt: [
    {
      title: "Customers, vendors and groups",
      body: "List, filter, multi-select and export across the bookkeeping side. Standard CRUD, and a lot of it — the volume is real even where the difficulty is not.",
    },
    {
      title: "Personal income and expense tracking",
      body: "The personal-finance counterpart to the business ledger: list screens, filters, and the categories behind them.",
    },
    {
      title: "Bills, utilities and data top-ups",
      body: "A purchase flow against third-party providers. Iterative rather than architectural — most of the work was in the edges of provider and amount validation.",
    },
    {
      title: "Business menu and tab navigation",
      body: "The bookkeeping and finance panes, and a substantial rework of the tab bar. Navigation shell, later carrying permission rules that decide which surfaces a role can even see.",
    },
    {
      title: "Refer and earn",
      body: "Referral tracking and the tabs around it.",
    },
    {
      title: "Profile and account settings",
      body: "Account screens, re-skinned through the theme migration.",
    },
    {
      title: "Three languages",
      body: "English, French and Portuguese copy across the screens I touched. Volume rather than invention, but a screen that breaks in French is broken for everyone using it.",
    },
  ],

  outcomes: [
    { label: "Shipped", value: "App Store · Play Store", caveat: "in production" },
    {
      label: "Features owned",
      value: "11",
      caveat: "by introduced mechanism and surviving lines, not file count",
    },
    { label: "Languages", value: "3" },
  ],

  lessons: [],

  stack: [
    "React Native",
    "Expo SDK 55",
    "TypeScript",
    "Expo Router",
    "NativeWind",
    "Redux Toolkit",
    "TanStack Query",
    "MMKV",
    "expo-secure-store",
    "EAS Build & Update",
  ],

  links: [
    {
      label: "App Store",
      href: "https://apps.apple.com/app/branddrive/id1623910229",
    },
    {
      label: "Google Play",
      href: "https://play.google.com/store/apps/details?id=com.branddrive",
    },
    { label: "Private repository", href: "#", private: true },
  ],
};

/**
 * Flagged placeholder for one reason only: the portal has not launched and the repo is
 * private, so nothing here can be checked by a reader. The firm itself is public. Flip
 * the flag the day it ships.
 *
 * The scope statement is narrow because the audit was unkind and correct — `useFilter`
 * has none of my surviving lines, and the pagination constant is someone else's. What
 * is mine is the URL sync and the loop it caused.
 */
const cwRealEstate: Project = {
  slug: "cw-real-estate",
  title: "CW Real Estate",
  summary:
    "A property search you can send to someone. Nine filter dimensions living in the URL instead of in React — and the render loop that taught me why the two fight.",
  year: "2025 — 2026",
  domains: ["frontend"],
  placeholder: true,

  role: "I introduced the URL synchronisation for customer search — `git log -S` puts that commit with me — and I am the dominant surviving author of the hero search surface it drives. I also fixed the listing render loop it caused. I did not write the filter hook underneath it, which has none of my lines, nor the pagination constants, nor the bookings and agent dashboards I contributed fixes to. Roughly seventy commits on a platform whose top three contributors have several hundred each.",

  problem:
    "A property search that cannot be sent to somebody is broken. Buyers compare listings with a partner, agents send a filtered view to a client, and every one of those journeys ends with a copied URL that either reproduces what the sender was looking at or does not. The platform kept filters in React state, so it did not — every link led to the same unfiltered list, and the search was effectively private to the tab it happened in.",

  constraints: [
    "The filter hook already existed and belonged to someone else. Replacing it was not on the table; the URL layer had to sit alongside it without taking ownership of the state.",
    "React Query already owned fetching, keyed on the filters. Adding the URL made three things with an opinion about what should be on screen — the hook, the address bar and the query cache.",
    "The API paginates by position and page size rather than cursors, so page state is a pair of numbers with no stable identity across a changed filter set.",
    "Five portals — customer, admin, listing agent, property owner, and a second admin mount — in one Next application, with the public listings route running through the super-admin property hook.",
  ],

  decisions: [
    {
      title: "The URL carries intent, not session",
      body: "Nine dimensions are mirrored into the address bar — location, listing type, property type, rooms, guests, price bounds and stay dates. Sort order and pagination deliberately are not. A shared link should reproduce what someone was looking *for*, and reopening it a week later should show today's matches rather than page three of a result set that has since changed. Putting everything in the URL is the easier rule and produces links that quietly rot.",
    },
    {
      title: "Search submits rather than listens",
      body: "The filter form is not bound live to the list. Nothing fetches until the search is submitted, which is why there is no debounce on the main query and no request per keystroke — the only debounced input is the places autocomplete, where suggestions genuinely are per-keystroke. Live-binding a filter set this wide to a paginated API is a request storm dressed as responsiveness.",
    },
    {
      title: "Derive the list, stop mirroring it",
      body: "The render loop came from copying query results into local state and running an effect to keep them aligned, while another effect forced a refetch whenever filters changed — work React Query already does through its keys. The fix removed the mirror entirely and narrowed the remaining effect to the two things that genuinely mean a new search: the pathname and the search params.",
    },
  ],

  tradeoffs: [
    {
      gave: "Sort order and page number out of the shared link",
      got: "Links that mean the same thing next week. Sort and page describe where you were in a list; the filters describe what you wanted, and only one of those is worth sending to somebody.",
    },
    {
      gave: "Results that update as you type",
      got: "One request per search instead of one per keystroke, across a filter set with nine dimensions and a paginated backend",
    },
    {
      gave: "Owning the filter state outright",
      got: "A URL layer that could ship without rewriting a hook three portals depend on — at the cost of leaving three sources of truth in place, which is exactly what produced the loop",
    },
  ],

  outcomes: [
    { label: "Filter dimensions in the URL", value: "9" },
    { label: "Portals in one application", value: "5" },
    {
      label: "Launched",
      value: "not yet",
      caveat: "the firm is public; this platform is unreleased",
    },
  ],

  lessons: [
    "THE LOOP FIX WAS A PATCH. Narrowing the effect dependencies and dropping the mirrored state stopped the symptom, and the underlying model is untouched — filters still live in a hook, in the URL and in a query key at once. Anyone who restores an unstable dependency or adds a second write path gets the same bug back, and nothing in the code warns them.",
    "THE PUBLIC LISTINGS ROUTE IMPORTS THE SUPER-ADMIN PROPERTY HOOK. The customer-facing search runs on the admin module rather than a read-only public feed, and there are three near-copies of that hook across portals which have already drifted. The right shape is one shared query hook with thin portal-specific UI over it; I worked within the wrong one instead of arguing for the right one.",
  ],

  stack: [
    "Next.js 15",
    "React 19",
    "TypeScript",
    "TanStack Query",
    "MUI",
    "Redux Persist",
    "Google Maps",
    "Socket.IO",
  ],

  links: [
    { label: "cwlagos.com — the firm", href: "https://cwlagos.com/" },
    { label: "Platform — unreleased", href: "#", private: true },
  ],
};

/**
 * Ownership here is stated as design rather than line count, deliberately. `git blame`
 * measures surviving lines, and several of these files have since been restyled by
 * colleagues — which moves the blame without moving a single decision.
 *
 * Where the audit and the author disagreed, `git log -S<symbol>` settled it: it finds
 * the commit that first introduced a piece of logic, regardless of who has touched the
 * file since. Both the kiosk verification and the tour flow trace back to commits of
 * mine, with every other contributor arriving afterwards.
 */
const whitePenguin: Project = {
  slug: "whitepenguin",
  title: "WhitePenguin",
  summary:
    "Preschool management for three audiences at once — owners, teachers and parents — including a shared tablet at the front door that strangers use one after another.",
  year: "2025 — 2026",
  domains: ["frontend"],

  // Captions here carry more weight than usual. This is a large product with several
  // hands on it, and a screenshot of a screen invites the reader to assume the screen is
  // yours — so each caption names the mechanism rather than the page it lives on.
  gallery: [
    {
      src: "/shots/whitepenguin/01-dashboard.png",
      alt: "WhitePenguin admin dashboard for a school called Greenwood High, with counters for students, teachers, open enquiries and waitlist, an action centre listing an overdue payment and booked tours, and attendance summary charts",
      caption:
        "The owner's view, for orientation. Open enquiries, waitlist and booked tours are the far end of the admissions pipeline — these counters move because of the two screens that follow.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/whitepenguin/02-admission-tours.png",
      alt: "Admission section on the Tours and Forms tab, listing admission forms and tour dates with their type, creation date and published status, beside tabs for events, leads and requests, and admissions",
      caption:
        "Tours and forms — one of the four admission tabs, all of which are mine. The tabs across the top are the pipeline in order: an enquiry becomes a lead, a lead becomes a booked visit, a visit becomes an admission.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/whitepenguin/03-admission-calendar.png",
      alt: "Weekly calendar view of the admission events tab, showing a single scheduled slot on Monday morning",
      caption:
        "Tour slots as a week. The calendar and the list are the same records seen two ways, so a school schedules against what is already booked rather than against its memory.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/whitepenguin/04-activities.png",
      alt: "Classroom activities screen with counters for meals, naps and shared media, quick-log buttons for nap, meal, water, media, medication, bathroom and observation, and a feed of recent activities",
      caption:
        "Room activities, which exist three times over — admin, staff and parent. A teacher logs a nap here and the parent reads it from the same record, which is the reason this could not be three separate features.",
      width: 1920,
      height: 1080,
    },
  ],

  role: "I designed and built the kiosk mode, the admissions pipeline, room activities across all three role surfaces, leads and requests, and the subdomain tenancy that separates one school from another. Colleagues layered UI onto several of those files afterwards, so line-level blame under-credits the logic — but the commits that first introduced each mechanism are mine. One exception worth naming: the offline attendance queue that makes the kiosk survive bad wifi was written later by a colleague. I opened that problem, and someone else solved its hardest half.",

  problem:
    "A preschool runs on three completely different relationships with the same data. An owner needs billing and compliance; a teacher needs the register and the day's activities; a parent needs to know their child arrived and what they did. Same records, three products. Then there is a fourth surface that is not a product at all — a tablet bolted by the front door, used by a queue of different parents every morning, with no one logged in and school wifi that drops.",

  constraints: [
    "Every school is a separate tenant reached on its own subdomain, and a request has to carry which school it belongs to without the user ever choosing.",
    "The kiosk is a shared, unattended, public-facing device. There is no per-user login in the ordinary sense and no assumption that the person in front of it is the same as the last one.",
    "School wifi is unreliable and the tablet sits at the door — the worst spot in the building. A missed check-in is a child whose parent is not told they arrived.",
    "The records include children's health information and photographs, so who can see what is the product rather than a feature of it.",
    "Three role surfaces — admin, staff, parent — plus kiosk, from one codebase and one deployment.",
  ],

  decisions: [
    {
      title: "The school comes from the host, not from a picker",
      body: "Tenancy is resolved from the subdomain and carried on every request, so a user never selects which school they are looking at and cannot be in the wrong one by accident. The alternative — a dropdown and an id in application state — makes the tenant a thing the client decides, and the first bug you get is somebody's data appearing under somebody else's letterhead.",
    },
    {
      title: "Kiosk as a mode inside the app, not a second application",
      body: "It shares the same routes, services and session plumbing rather than being built and deployed separately. A second app would have meant two release cycles and two copies of the attendance logic drifting apart. The cost is that the kiosk lives inside a build that also contains the admin panel, which is a boundary that then has to be defended deliberately rather than by architecture.",
    },
    {
      title: "Two layers of identity on one tablet",
      body: "The device is unlocked once by the school, and each person at it identifies themselves separately — a parent by email and a four-digit PIN or a scanned code, a teacher from the roster. Asking a parent at a doorway to type a password would take longer than the drop-off itself; a device with no identity at all cannot tell you who signed the child in.",
    },
    {
      title: "Logout flushes before it clears",
      body: "Ending a kiosk session pushes any pending attendance before wiping the session keys. Clearing first is the obvious order and quietly discards the check-in that was mid-flight — the exact event the whole surface exists to record.",
    },
  ],

  tradeoffs: [
    {
      gave: "A separate, hardened kiosk application",
      got: "One codebase, one release, and attendance logic that cannot drift between two implementations — at the price of a boundary that has to be enforced rather than assumed",
    },
    {
      gave: "Passwords at the door",
      got: "A four-digit PIN and a queue that moves at drop-off speed. Shorter secrets on a shared device are a real reduction in strength, accepted because the alternative is a system nobody uses.",
    },
    {
      gave: "Letting the client pick its tenant",
      got: "A school that follows from the address bar, so being in the wrong tenant requires being at the wrong URL rather than making the wrong selection",
    },
  ],

  outcomes: [
    { label: "Live", value: "app.whitepenguin.co", caveat: "in production" },
    { label: "Role surfaces", value: "4", caveat: "admin, staff, parent, kiosk" },
    { label: "Tenancy", value: "subdomain", caveat: "one school per host" },
  ],

  lessons: [
    "THE KIOSK IS NOT ISOLATED ENOUGH. The device is unlocked with a school admin's session and that session stays live underneath the parent PIN layer, so the tablet by the front door can still reach the admin panel. No server check can fix it — the admin's token is genuinely valid. It needs its own restricted account, a hard idle timeout and a full storage wipe between sessions, and it is the first thing I would change.",
  ],

  stack: [
    "Next.js 15",
    "React",
    "TypeScript",
    "TanStack Query",
    "Axios",
    "Firebase Cloud Messaging",
    "Paystack",
    "IndexedDB",
    "Service Workers",
  ],

  links: [{ label: "app.whitepenguin.co", href: "https://app.whitepenguin.co/" }],
};

/**
 * Written from a repository audit, including `git blame` on every file claimed below.
 * The scope statement is deliberately narrow: 109 commits out of roughly three
 * thousand across a twelve-person team buys authorship of one module, not a product.
 */
const nivram: Project = {
  slug: "nivram",
  title: "Nivram — BrandDrive's AI assistant",
  summary:
    "An AI assistant that doesn't just answer questions about a business's books — it proposes actions against them, and I built the layer that decides when those are safe to run.",
  year: "2026",
  domains: ["frontend", "ai"],

  // Web first, because the web interaction layer is entirely mine and because that one
  // frame contains the whole argument: collected input, a reviewable summary, and a
  // single button that calls a production endpoint. The mobile sequence follows.
  gallery: [
    {
      src: "/shots/nivram/01-web-action-card.png",
      alt: "Nivram open as an overlay on the BrandDrive web dashboard: the assistant asks for a first and last name, the user replies John Doe, and the assistant returns a customer summary with a Create customer button beneath it",
      caption:
        "The web client, where the interaction layer is entirely mine. This one frame is the shape the whole study is about: the assistant collects what it needs, renders a summary you can check, then mounts a single button that calls the same production endpoint the app's own customer screen calls.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/nivram/02-new-chat.png",
      alt: "Nivram's empty chat screen on mobile in dark theme: a sparkle mark, a greeting, a note that five messages remain in the daily usage, a composer for questions about personal finances, and intent chips for create, analyze, compare and track",
      caption:
        "Mobile, at the start. The chips are the assistant's four verbs — create, analyse, compare, track — so a first-time user has somewhere to begin other than a blank prompt, and the remaining quota is shown before it is spent rather than after.",
      width: 499,
      height: 1080,
    },
    {
      src: "/shots/nivram/03-streaming.png",
      alt: "A Nivram conversation mid-reply on mobile: the user's question, a status line reading Stewing, and an assistant message partially written out",
      caption:
        "Mid-stream. 'Stewing…' is the thinking event of the socket protocol — start, thinking, chunk, end — and the prose beneath it is written out of a partial buffer at one render per frame rather than one per token. Nothing pressable has mounted yet: the text streams, the structure waits until the payload is whole.",
      width: 499,
      height: 1080,
    },
    {
      src: "/shots/nivram/04-answer.png",
      alt: "A completed Nivram answer on mobile in light theme, rendered as markdown with headings, bold terms and nested bullets, above copy, thumbs-up, thumbs-down and share controls",
      caption:
        "Finished. Markdown as it arrives — headings, emphasis, nested lists — with the message controls attaching once the answer is complete.",
      width: 499,
      height: 1080,
    },
    {
      src: "/shots/nivram/05-sidebar.jpeg",
      alt: "Nivram's chat drawer on mobile showing search, a new-chat action, a daily usage meter reading five of five left, and tabs for chats and favourites above a saved conversation",
      caption:
        "Conversation management. A chat begins as a local draft and is promoted to a server thread mid-reply, so the key identifying it changes while a message is still arriving — which is why the socket handler reads the current key instead of closing over it.",
      width: 499,
      height: 1080,
    },
  ],

  role: "I built Nivram's client on both platforms. On the web the AI interaction layer is entirely mine. On mobile I built both halves: the streaming shell — socket handler, frame scheduler, chunk merge, message list, chat screens, at 88–100% of surviving lines and 100% of the frame scheduler — and the interaction layer the stream feeds, covering the component registry (84%), the structured parser (96%), the PIN gate (83%), the personal/business resolver (75%), and the hidden message that reports a result back to the model (100%). Of the seventy action cards, sixty-one are majority mine — 78% of the lines across them; colleagues wrote the personal bill-pay and transfer cards. I did not build the apps around all this: BrandDrive mobile alone is twelve people and roughly three thousand commits, of which 109 are mine.",

  problem:
    "Nivram answers questions about a business's own books — receivables ratios, top suppliers, revenue forecasts, when to restock. Those answers take real time to generate, so a request-response interface leaves an owner staring at a spinner wondering whether it has hung. Streaming fixes that, and React Native does not stream: its `fetch` gives you no readable response body, so the pattern every web tutorial assumes simply does not exist on the platform.",

  constraints: [
    "React Native's `fetch` has no streamable response body — `getReader()` does not exist, so the standard web approach is unavailable.",
    "The app already had a shared WebSocket hook, and it stored the last event in `useState`. At Nivram's chunk rate, events overwrite each other and text goes missing.",
    "A chat begins as a local draft and is promoted to a server thread mid-conversation — the key identifying the conversation changes while a reply is still arriving.",
    "Answers are not prose. The envelope carries a typed payload that drives roughly ninety review cards — create a customer, raise an invoice, pay a bill, move money between wallets — each calling the same production endpoints as the app's own screens, with a transaction PIN in front of anything that spends. The renderer has to hold a half-arrived object whose finished form can move somebody's money.",
    "The model ships on its own schedule and the app ships through two app stores. A user on last month's build will be offered actions their copy has never heard of, and there is no way to force them to update.",
  ],

  decisions: [
    {
      title: "Sockets, because the platform ruled out the alternative",
      body: "With no streamable response body in React Native, the server emits discrete events over Socket.IO — start, thinking, chunk, end — rather than a chunked HTTP body. Nivram attaches its own listener instead of using the app's shared WebSocket hook, because that hook keeps only the latest event in state and would drop chunks the moment they arrive faster than React re-renders.",
    },
    {
      title: "One render per frame, not one per token",
      body: "Tokens arrive far faster than a screen refreshes. Each one is coalesced into a ref and flushed to the store on a `requestAnimationFrame` tick, so the list re-renders about sixty times a second regardless of whether sixty tokens arrived or six hundred. Dispatching per token is the obvious implementation and it makes the UI stutter exactly when the user is watching it most closely.",
    },
    {
      title: "A listener that survives the conversation being renamed",
      body: "When a draft is promoted to a real thread the chat key changes underneath an in-flight reply. Re-binding the socket listener on that change would drop the rest of the message, so the handler is held in a ref and reads the current key rather than closing over it. It is the kind of bug that only appears on the first message of a new chat, which is the first thing any user does.",
    },
    {
      title: "Merge chunks defensively, in both shapes",
      body: "Chunks arrive sometimes as deltas to append and sometimes as cumulative snapshots of everything so far. The merge checks whether the incoming chunk already starts with what is held and appends or replaces accordingly, so a change of server behaviour degrades into a redundant assignment instead of duplicated text.",
    },
    {
      title: "Stream the prose, wait for the structure",
      body: "The envelope carries a message alongside component and data fields. The text is pulled from the partial buffer and rendered as markdown while it arrives, so the answer reads as it is written; anything the user can press mounts only once the object is complete. Those controls are not decorative — they call the same production endpoints as the app's own screens, and some of them move money. A button rendered from a half-parsed payload is a transfer with a missing field behind a confirm the user has already trusted. Arriving a second late is the correct failure.",
    },
    {
      title: "A registry the model is allowed to outrun",
      body: "Component types resolve through a central map, and an unrecognised one renders nothing — a warning in development, silence in production. That sounds like giving up and is the opposite: the assistant releases continuously while the app crawls through two review queues, so a user on last month's build will certainly be offered a card their copy has never heard of. The choice is between a missing card and a crash, and only one of those lets the rest of the answer still be useful.",
    },
    {
      title: "The PIN gate wraps the action instead of living inside it",
      body: "Money-moving cards are not mounted and then asked for authorisation. A gate component opens the transaction PIN modal first, merges the PIN into the payload, and only then mounts the real action with the authorisation already present — so the component never exists in an unauthorised state. Putting the check inside each card would have meant seventy chances to forget it; this way there is one, and forgetting is not among the available mistakes.",
    },
    {
      title: "The result is whispered back into the conversation",
      body: "When a card succeeds it does not just close. A hidden message goes back up the same socket carrying what happened, so the assistant's next turn knows the customer now exists or the transfer went through. Fire-and-forget would have been one line instead of the round trip — and would leave the model confidently offering to create a record it just created, because nothing ever told it otherwise. The conversation is the state; anything that changes the world has to say so.",
    },
    {
      title: "Only the newest card is live",
      body: "Every assistant card except the most recent is disabled. Scrolling up and pressing a confirm from three answers ago would fire an action against a payload the conversation has moved past — on a financial app, most likely a second transfer. The stale ones stay visible as a record of what was offered, and refuse to do anything.",
    },
  ],

  tradeoffs: [
    {
      gave: "Reusing the app's shared WebSocket abstraction",
      got: "Chunks that survive arriving faster than React renders. The house abstraction was correct for every other feature and wrong for this one, which is a harder thing to argue for than writing something new.",
    },
    {
      gave: "Up to one frame of latency on every token",
      got: "A render rate bounded by the display rather than by the model's output rate. Sixteen milliseconds is invisible; a list re-rendering four hundred times a second is not.",
    },
    {
      gave: "Interactive components appearing after the text finishes rather than alongside it",
      got: "No possibility of rendering a control from a half-parsed payload. For components that move money, arriving late is the correct failure.",
    },
    {
      gave: "A hand-written Android keyboard lift instead of the built-in avoidance view",
      got: "A composer that stays above an edge-to-edge IME while the answer streams behind it. iOS keeps the standard behaviour; only Android needed the measurement.",
    },
  ],

  outcomes: [
    { label: "Shipped", value: "App Store · Play Store", caveat: "in production" },
    { label: "Store updates cut", value: "OTA", caveat: "shipped over the air through EAS Update" },
    {
      label: "Render rate",
      value: "1 / frame",
      caveat: "coalesced from an unbounded token rate",
    },
    {
      label: "Streaming layer",
      value: "88 – 100%",
      caveat: "surviving lines by git blame across the four core files",
    },
    {
      label: "Interaction system",
      value: "75 – 100%",
      caveat: "registry, parser, PIN gate, resolver, and the hidden result message",
    },
    { label: "Tests in the module", value: "72+", caveat: "Jest files under the Nivram tree" },
  ],

  lessons: [
    "BACKGROUNDING IS UNHANDLED at the feature level. The socket reconnects with a fresh token when the app returns to the foreground, and an interrupted stream relies on that reconnection rather than any deliberate resume. It works because Socket.IO retries forever, which is not the same as being designed for.",
  ],

  stack: [
    "React Native",
    "Expo SDK 55",
    "TypeScript",
    "Expo Router",
    "Socket.IO",
    "Redux Toolkit",
    "TanStack Query",
    "MMKV",
    "EAS Build & Update",
    "Jest",
    "Maestro",
  ],

  links: [
    {
      label: "App Store",
      href: "https://apps.apple.com/app/branddrive/id1623910229",
    },
    {
      label: "Google Play",
      href: "https://play.google.com/store/apps/details?id=com.branddrive",
    },
    { label: "Private repository", href: "#", private: true },
  ],
};

/**
 * Drafted from an audit of the repository, so the architecture, constraints and
 * trade-offs below are read from the code rather than remembered — and every claim
 * about the payment path was verified against the source before it was written down.
 */
const sanctuary: Project = {
  slug: "sanctuary-altar",
  title: "Sanctuary Altar of Christ Ministry",
  summary:
    "A church's public site, admin dashboard and donation flow — eight months live, and an audit that found it could take money without recording it.",
  year: "2025 — 2026",
  domains: ["frontend"],

  // Public face first, then the surface volunteers actually live in. The admin side is
  // where the work is, but nobody believes an admin panel for a site they have not seen.
  gallery: [
    {
      src: "/shots/sanctuary-altar/01-homepage.png",
      alt: "Church homepage: navigation with a Give button and language switcher above a candlelit hero reading Welcome to Sanctuary Altar of Christ Ministry, over cards for service times and location",
      caption:
        "The homepage. Give sits in the header rather than inside a menu — the shortest path from arriving to giving, which is the path the whole donation architecture exists to protect.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/sanctuary-altar/02-public-contact.png",
      alt: "Public site with the language menu open showing nine options including Igbo, Hausa and Yoruba, above a Google map of the church in Kubwa, Abuja",
      caption:
        "The public site, language switcher open. Nine languages including Igbo, Hausa and Yoruba — in Abuja, a congregation that does not all read English is not an edge case.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/sanctuary-altar/03-admin-dashboard.png",
      alt: "Admin dashboard with counters for sermons, events, blog posts and total donations, beside a content-distribution doughnut chart and a donation-trend line chart",
      caption:
        "The admin dashboard. Every figure here traces back to a record a signature-verified webhook wrote rather than to something a browser claimed, which is what makes the donation trend a report instead of an estimate.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/sanctuary-altar/04-members.png",
      alt: "Admin members table listing four member records with contact details, membership type, status badges and inline view, edit and delete actions, above counters for total, active, pending and inactive",
      caption:
        "Members. Counters, search, filters, then rows with their actions inline — the same shape the other collections use, which is the only reason a volunteer learns it once and can then edit anything. The records shown are test data.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/sanctuary-altar/05-notifications.png",
      alt: "Notifications screen with email and push tabs, audience filters for membership status and type, an estimated recipient count, and a message composer",
      caption:
        "Announcements by email or as push to PWA subscribers, filtered by membership status and type. The recipient count sits next to the filters rather than behind a confirm dialog — a volunteer should see who they are about to message before they write it.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/sanctuary-altar/06-settings.png",
      alt: "Site settings form with fields for site name, description, contact email, phone and address, plus tabs for bank accounts and general settings",
      caption:
        "Settings, edited by volunteers rather than by me. The constraint that shaped this entire surface was that anything needing a runbook would simply never get used.",
      width: 1920,
      height: 1080,
    },
    {
      src: "/shots/sanctuary-altar/07-gallery.png",
      alt: "Gallery manager showing a single uploaded image as a card with its filename and upload date, beside an upload button and a search field",
      caption:
        "The gallery manager. Upload, search and per-item controls in the same shape as every other collection — and built for the empty case as deliberately as the full one, because empty is what a volunteer meets on their first day.",
      width: 1920,
      height: 1080,
    },
  ],

  role: "Sole developer, and the one who decided it should exist — this was proposed rather than commissioned. Public site, admin dashboard, donation flow and the Firebase backend behind them. Started from a Vite/React template; the 115 commits after the first are mine. Live and maintained across eight months.",

  problem:
    "One place for a church to run itself: sermons and events published as they happen, members reachable, and giving handled online in Naira. The people editing it daily are volunteers, not developers, and the congregation reaches it on mobile data of varying quality. The hard part was never the public site — it was that a privileged admin surface and an anonymous public one had to live in the same deployment, with no server between them.",

  constraints: [
    "Paystack, in Naira. The payment provider was a given rather than a choice, and its flow shaped the whole donation path.",
    "Content edited daily by volunteers who will never read documentation. Anything requiring a runbook would simply not get used.",
    "Firebase as the entire backend — no server to run, and therefore no trusted place to execute logic unless it was written as a callable function or a security rule.",
    "A congregation on mobile connections that drop. Offline could not mean a browser error page.",
    "One deployment serving both an anonymous public site and a privileged admin dashboard.",
  ],

  decisions: [
    {
      title: "Authorization in security rules, not in route guards",
      body: "Client-side guards decide what is *shown*; Firestore rules decide what is *allowed*. Every privileged collection is gated by rules that read the caller's role server-side, so hiding a menu item is a courtesy rather than the protection. Bypassing the UI gets you nothing.",
    },
    {
      title: "Roles as documents rather than custom claims",
      body: "Roles live in a `user_roles` collection that rules can read directly, and client writes to it are denied outright — only the admin SDK can assign one. Custom claims would have avoided a read per check but require a token refresh to take effect, which means a demoted admin keeps their access until they sign out again.",
    },
    {
      title: "A hand-written service worker instead of a PWA plugin",
      body: "Network-first for navigation and Firebase so content is never stale; cache-first for static assets; video fetched but never cached, because filling a phone's storage with sermon recordings is a way to get uninstalled. Offline falls back to the cached shell rather than the browser's error page.",
    },
    {
      title: "The transaction reference is the document ID",
      body: "Donations are written with `setDoc` keyed on the Paystack reference rather than `addDoc` with a generated one. Paystack retries webhooks until it gets a 200, so duplicate delivery is expected rather than exceptional — and keying on the reference makes a repeat write land on the same document instead of creating a second record. Idempotency becomes a property of the data model rather than a check somebody has to remember to write.",
    },
    {
      title: "The client proposes, the server confirms",
      body: "The record is written as `pending` before Paystack opens, so an abandoned payment leaves something to reconcile instead of nothing. Promotion to `success` comes from a Cloud Function that verifies the `x-paystack-signature` HMAC against the raw request body — parsing first and re-serialising would silently never match — and rejects before doing any other work. Security rules enforce the split rather than trusting it: a client may only ever write `pending`, and `success` is reachable only through the admin SDK, which bypasses rules entirely. A forged donation record is not discouraged, it is unreachable.",
    },
  ],

  tradeoffs: [
    {
      gave: "A hand-written service worker rather than an off-the-shelf PWA plugin",
      got: "Explicit control over what is cached and what is deliberately not — video excluded outright. The cost is that every caching bug is now mine, and the service worker is the area the commit history shows me fixing most often after the UI.",
    },
    {
      gave: "A Firestore read on every permission check",
      got: "Role changes that take effect immediately, instead of whenever the user's token next refreshes",
    },
    {
      gave: "Any server of my own",
      got: "Nothing to operate, patch or pay for — and, as it turned out, nowhere trusted to confirm that a payment actually happened. That trade is the origin of the defect below, and I did not see it at the time.",
    },
  ],

  outcomes: [
    { label: "Live", value: "8 months", caveat: "and still maintained" },
    { label: "Commits", value: "116" },
    {
      label: "Entities managed",
      value: "12",
      caveat: "sermons, events, members, donations, prayers, contacts and more",
    },
  ],

  lessons: [
    "SHIPPED BROKEN, SINCE FIXED — the first version recorded donations only from a client-side callback. If the browser closed after Paystack took the money but before that callback ran, the charge succeeded and no record existed; a failed write after a successful charge showed the donor an error while the money was already gone. I found it auditing my own payment path months after shipping, not because anyone reported it — which is the uncomfortable part. A silent failure produces no complaints.",
    "THE REWRITE moved the trust boundary. A signature-verified webhook is now the authority on whether a payment happened and the client merely proposes, while the transaction reference became the Firestore document ID so retried deliveries converge instead of multiplying. The lesson generalises past payments: anything a client asserts about money is a claim rather than a fact, and the architecture should make that distinction structural instead of relying on everyone remembering it.",
    "FIXED — one callable function verified admin rights and its neighbour checked only that the caller was signed in. Two functions written weeks apart, one hardened and one not, which is how authorization gaps survive review. A shared assertion helper existed precisely to prevent this and I did not apply it consistently.",
    "ALSO FIXED — the client could originally write `status: 'success'` directly as a UI convenience, so a forged record was possible even though no money moved. Rules now accept only `pending` from a client. The general shape of all three of these: the first version trusted the browser to report what had happened, and every fix was some version of moving that authority to somewhere the browser cannot reach.",
  ],

  stack: [
    "React",
    "TypeScript",
    "Vite",
    "Firebase",
    "Cloud Functions",
    "Firestore Rules",
    "React Query",
    "React Hook Form",
    "Chart.js",
    "Paystack",
  ],

  links: [
    { label: "sanctuaryaltar.org", href: "https://www.sanctuaryaltar.org" },
    { label: "Private repository", href: "#", private: true },
  ],
};


export const PROJECTS: Project[] = [nivram, brandDriveMobile, whitePenguin, cwRealEstate, doorAccess, sanctuary];

export function getProject(slug: string): Project | undefined {
  return PROJECTS.find((project) => project.slug === slug);
}

export const REAL_PROJECTS = PROJECTS.filter((project) => !project.placeholder);

/**
 * What the site is actually allowed to show.
 *
 * A draft stays visible in development so it can be read and edited in place, and
 * vanishes from a production build entirely — no route generated, no index entry, no
 * page to stumble onto. Unfinished work living in the repository is normal; unfinished
 * work reachable on the internet is not, and the difference should not depend on
 * remembering to pass a flag.
 *
 * The STRICT_CONTENT test is the second line of defence, not the first. A guard whose
 * only effect is failing a build that people can choose not to run is not a guard.
 */
export function projectsFor(includeDrafts: boolean): Project[] {
  return includeDrafts ? PROJECTS : REAL_PROJECTS;
}

export const VISIBLE_PROJECTS = projectsFor(
  process.env.NODE_ENV !== "production",
);

export function getVisibleProject(slug: string): Project | undefined {
  return VISIBLE_PROJECTS.find((project) => project.slug === slug);
}
