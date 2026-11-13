export interface SkillGroup {
  label: string;
  items: string[];
}

export interface Position {
  role: string;
  org: string;
  location?: string;
  /** "Mar 2025" — a month and a year. Parsers want both; a bare year scores worse. */
  start?: string;
  /** "Present" for a current role. */
  end?: string;
  points: string[];
}

export interface ResumeProject {
  name: string;
  kind: string;
  points: string[];
  href?: string;
}

export interface EducationEntry {
  institution: string;
  award: string;
  /** "2020 — 2025" — a parser wants years, not months, for a degree span. */
  span: string;
  /** Omitted entirely when there's nothing distinctive to list yet. */
  coursework?: string[];
}

/**
 * The CV as data.
 *
 * One source, rendered to the screen and to paper by the same component — so the printed
 * copy can never drift out of step with the web one, which is the failure mode of keeping
 * a separate PDF up to date by hand.
 *
 * Written to be read twice: once by a parser and once by a person.
 *
 * The parser wants literal section names, dated roles, bullets that begin with a verb,
 * and the exact spelling of technologies as job descriptions write them — "React Native",
 * not "RN"; "REST APIs", not "endpoints". It cannot infer, so nothing here relies on
 * inference. The person wants a specific claim with a number attached, which is the same
 * discipline the case studies use: a result without its scale is a result nobody can
 * check.
 *
 * The two are not in tension as often as people assume. Almost everything that helps a
 * parser — saying the thing plainly, dating it, quantifying it — also helps the human
 * who reads it after.
 *
 * Two conventions follow from the parser half:
 *
 * Numbers are written as numerals, never as words. "Seventy action cards" and "70 action
 * cards" say the same thing to a person and different things to a scorer, which matches on
 * digits and cannot see the spelled-out form at all. Prose style loses this argument.
 *
 * No two bullets open with the same verb. A resume that says "Built" five times reads as
 * one job done five times; the variety is not decoration, it is the only signal in a
 * bullet list that the work differed.
 */
export const RESUME = {
  name: "David Uchenna Agodi",
  title: "Frontend Engineer · React · React Native · AI Interfaces",

  /**
   * Front-loaded with the role title and the years, because both are matched literally,
   * and closed with the thing that is actually distinctive. The previous version opened
   * "A highly motivated and innovative Engineer with a comprehensive foundation in…",
   * which spent two lines before saying anything a reader could use.
   */
  summary:
    "Frontend Engineer with 3+ years building production web and mobile interfaces in React, Next.js, TypeScript and React Native. Most recently at BrandDrive, where I owned the client for an AI assistant that streamed model output over WebSockets and rendered it into 70+ reviewable actions calling the same production endpoints as the app itself, shipped across a 12-person React Native codebase. Mechatronics background in embedded systems and control, so I work comfortably at the seam between physical systems and the web.",

  contact: {
    email: "agodidavid004@gmail.com",
    phone: "+370 662 13 951",
    github: "github.com/Bossmandave",
    /** Filled in when supplied — the renderer omits anything blank rather than printing a gap. */
    linkedin: "linkedin.com/in/david-uchenna-agodi-369a88283",
    location: "Vilnius, Lithuania",
    portfolio: "agodidavid.vercel.app",
  },

  /**
   * Grouped, because a parser reads the whole block either way and a person cannot read
   * forty comma-separated words. Names are spelled the way job descriptions spell them.
   */
  skills: [
    {
      label: "Frontend",
      items: [
        "React",
        "Next.js",
        "TypeScript",
        "JavaScript (ES6+)",
        "React Native",
        "Expo",
        "HTML5",
        "CSS3",
        "Tailwind CSS",
        "Framer Motion",
        "Responsive Design",
        "Web Accessibility (WCAG)",
      ],
    },
    {
      label: "State & data",
      items: [
        "Redux Toolkit",
        "React Query",
        "Context API",
        "React Hook Form",
        "REST APIs",
        "WebSockets",
        "Socket.IO",
        "Real-time streaming",
      ],
    },
    {
      label: "Backend & cloud",
      items: [
        "Node.js",
        "Python",
        "Flask",
        "Firebase",
        "Cloud Firestore",
        "Cloud Functions",
        "Firebase Authentication",
        "Paystack",
        "Webhooks",
      ],
    },
    {
      label: "Testing & tooling",
      items: [
        "Vitest",
        "Git",
        "GitHub",
        "Vercel",
        "CI/CD",
        "Agile / Scrum",
        "Code review",
        "Performance optimisation",
        "Figma",
      ],
    },
    {
      label: "Embedded & graphics",
      items: [
        "Raspberry Pi",
        "Arduino",
        "OpenCV",
        "Control systems",
        "Sensor integration",
        "WebGL",
        "GLSL",
        "3D design & printing",
      ],
    },
  ] satisfies SkillGroup[],

  experience: [
    {
      role: "Frontend Engineer",
      org: "BrandDrive",
      location: "Nigeria (hybrid)",
      start: "Nov 2025",
      end: "Aug 2026",
      points: [
        "Owned the client for Nivram, the company's AI assistant, across 2 platforms — the web interaction layer end to end, and on React Native both the streaming shell and the layer it feeds.",
        "Engineered a Socket.IO streaming pipeline that coalesces tokens into 1 render per animation frame, cutting re-renders by ~90% at peak load (600 tokens/second collapse to 60 renders) and holding a steady 60 fps repaint.",
        "Shipped the interaction layer that turns partial model output into 70+ reviewable action cards, each calling the same production endpoints as the app's own screens, with a PIN gate that merges authorisation into the payload before a card mounts.",
        "Standardised theming across a 12-person React Native codebase, retrofitting a single token system onto 100% of existing screens and removing per-screen colour constants.",
        "Delivered 3 features end to end — invoicing, an app-lock overlay with biometric and passcode fallbacks, and Android keyboard and inset handling that measures device geometry rather than assuming it.",
      ],
    },
    {
      role: "Web Development Intern",
      org: "Zidio Web Development",
      location: "Remote",
      start: "Jul 2024",
      end: "Oct 2024",
      points: [
        "Implemented responsive web interfaces in HTML, CSS and JavaScript, reviewing all work into a shared Git repository through pull requests.",
      ],
    },
    {
      role: "STEM Collaborator",
      org: "3D Robotics",
      location: "Nigeria",
      start: "Jun 2024",
      end: "Oct 2024",
      points: [
        "Integrated web technologies with cloud platforms for interactive STEM learning tools.",
      ],
    },
    {
      role: "Frontend Developer Intern",
      org: "Juray Smart Solutions Ltd",
      location: "Nigeria",
      start: "Feb 2024",
      end: "Jun 2024",
      points: [
        "Developed and maintained client-facing React interfaces against REST APIs, translating Figma handoffs into responsive components.",
      ],
    },
    {
      role: "Robotics Intern",
      org: "Baun Robotics Educational Solutions",
      location: "Nigeria",
      start: "Jun 2022",
      end: "Oct 2022",
      points: [
        "Programmed and assembled robotics teaching kits, and ran hands-on STEM workshops for secondary-school students.",
      ],
    },
  ] satisfies Position[],

  projects: [
    {
      name: "Nivram — AI assistant client",
      kind: "React · React Native · Socket.IO · BrandDrive",
      /** Nivram ships inside the BrandDrive app, so the store listing is its public proof. */
      href: "https://apps.apple.com/app/branddrive/id1623910229",
      points: [
        "Architected streaming over Socket.IO after React Native's fetch proved to expose no readable response body, ruling out the standard web streaming approach on 1 of the 2 target platforms.",
        "Hardened chunk merging against both delta and cumulative payload shapes, holding the socket handler in a ref so an in-flight reply survives a draft chat being promoted to a server thread mid-message.",
        "Eliminated a class of half-parsed-payload bug by gating pressable controls behind a complete object while still streaming prose as markdown — a button built from a partial parse is a transfer with a missing field behind a confirm the user has already trusted.",
      ],
    },
    {
      name: "BrandDrive Mobile",
      kind: "React Native · Expo · production fintech app",
      href: "https://apps.apple.com/app/branddrive/id1623910229",
      points: [
        "Built 5 features into a live fintech app — theming, invoicing end to end, credit notes, the personal home screen and the app-lock overlay — and rebuilt the transfers interface and its internal logic.",
        "Resolved Android bottom-sheet layout against the software keyboard and 3-button navigation bar by responding to measured device geometry instead of a constant that happens to be correct on 1 device.",
        "Designed the personal dashboard around its 3 empty states — no wallet, no transaction PIN, a negative balance — because those are what a new user meets on their first morning.",
      ],
    },
    {
      name: "WhitePenguin",
      kind: "Multi-tenant preschool platform · live in production",
      href: "https://app.whitepenguin.co",
      points: [
        "Launched subdomain-based tenancy so a school resolves from the host rather than a client-side selection, removing 100% of client-controlled tenant routing and the cross-tenant data bugs that come with it.",
        "Secured kiosk mode for a shared, unattended tablet behind 2 layers of identity — a 4-digit PIN or scanned code per person — with a logout that flushes pending attendance before clearing session keys.",
        "Consolidated the admissions pipeline — forms, tour scheduling, leads and requests — plus room activities across 3 role surfaces into 1 codebase.",
      ],
    },
    {
      name: "Sanctuary Altar of Christ Ministry",
      kind: "React · TypeScript · Firebase · Paystack · 8 months live",
      href: "https://www.sanctuaryaltar.org",
      points: [
        "Led development as sole engineer across 3 surfaces — public site, admin dashboard and donation flow — shipping 116 commits and 12 managed collections, live and maintained for 8 months.",
        "Migrated payment authority to a signature-verified Cloud Function webhook after an audit of my own flow found a browser closing mid-redirect could take money without recording it.",
        "Prevented duplicate donation records by keying each document on the Paystack transaction reference, collapsing any number of retried webhook deliveries to 1 stored record.",
        "Enforced authorisation in Firestore security rules rather than route guards, and hand-wrote a service worker across 3 caching strategies: network-first content, cache-first assets, video excluded.",
      ],
    },
    {
      name: "Face-Recognition Door Access",
      kind: "React · Python · Flask · Raspberry Pi · final-year project",
      points: [
        "Achieved 1.3 s face matches and 800 ms end-to-end remote unlock running recognition entirely on-device on a Raspberry Pi 4 at a 0.40 distance threshold, with 0 face data leaving the device.",
        "Automated fail-safe locking through a Flask control API driving a solenoid lock via relay, holding auto-lock on a background deadline so a dropped request can never leave a door open.",
        "Deployed a React dashboard to Vercel against the device behind a tunnel, combining 4 capabilities: live MJPEG feed, remote unlock, face enrolment and an access log.",
      ],
    },
  ] satisfies ResumeProject[],

  education: [
    {
      institution: "Vilnius Gediminas Technical University (Vilnius Tech), Lithuania",
      award: "M.Eng, Mechatronics, Robotics, and Automation Engineering",
      span: "2026 — Present",
    },
    {
      institution: "Afe Babalola University, Ado-Ekiti, Nigeria",
      award: "B.Eng, Mechatronics Engineering",
      span: "2020 — 2025",
      coursework: [
        "Embedded Systems",
        "Control Systems",
        "Instrumentation",
        "Heat Transfer",
      ],
    },
  ] satisfies EducationEntry[],
} as const;
