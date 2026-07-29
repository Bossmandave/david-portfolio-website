import type { Shipped } from "@/content/types";

/**
 * The second tier: things that work, with a link to prove it.
 *
 * No narrative arc, no forced connection to control systems. Some frontend work is a
 * brief, a deadline and a stakeholder, and pretending otherwise to fit a thesis reads
 * as exactly what it is. The featured case studies carry the argument; this carries the
 * range — and a hiring manager reads range as "can build the thing I actually need",
 * which no amount of control theory says on its own.
 *
 * Order is newest first. Keep the summaries to one line; the discipline is the point.
 */
// Sanctuary Altar moved to the featured tier — see content/projects.ts. An eight-month
// live product with a payment flow is not a one-line entry.
export const SHIPPED: Shipped[] = [
  {
    name: "The Princess Fashion World",
    summary:
      "Catalogue and admin dashboard for a fashion boutique — retail and wholesale, with orders taken over WhatsApp rather than a checkout.",
    year: "2025 — 2026",
    context: "Client work",
    stack: [
      "React",
      "Firebase",
      "React Router",
      "TanStack Query",
      "Framer Motion",
    ],
    href: "https://theprincessfashionworld.com/",
  },
  // CW Real Estate moved to the featured tier — see content/projects.ts.
  {
    name: "CVerify",
    summary:
      "Certificate verification for organisations — public lookup, with an admin dashboard behind it for managing records.",
    year: "2025",
    context: "Personal",
    stack: ["React", "TypeScript", "Tailwind CSS", "Vercel"],
    href: "https://cverify.vercel.app/",
  },
];

export const REAL_SHIPPED = SHIPPED.filter((entry) => !entry.placeholder);

/** Drafts are visible while developing and absent from production. See projects.ts. */
export const VISIBLE_SHIPPED =
  process.env.NODE_ENV === "production" ? REAL_SHIPPED : SHIPPED;
