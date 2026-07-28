/**
 * A measured result.
 *
 * `caveat` is not optional decoration — it is the reason this type exists. A number
 * without its sample size, its measurement conditions, or the word "backtest" attached
 * is a claim a reader cannot check, and a claim a reader cannot check is one they will
 * assume is inflated. Making the caveat a field means a result cannot be published
 * without the author having looked at whether it needs one.
 */
export interface Metric {
  label: string;
  value: string;
  caveat?: string;
}

export interface Decision {
  title: string;
  body: string;
}

export interface Tradeoff {
  /** What was given up. */
  gave: string;
  /** What that bought. */
  got: string;
}

export interface ProjectLink {
  label: string;
  href: string;
  /** Marks links that are not publicly reachable, so the UI can say so rather than 404. */
  private?: boolean;
}

export interface Project {
  slug: string;
  title: string;
  /** One line. Shown in the index. */
  summary: string;
  year: string;
  /** Where the work sits: this drives ordering and the index filters. */
  domains: Array<"frontend" | "mechatronics" | "ai" | "embedded">;

  /**
   * What was personally owned, stated plainly — including where the boundary was.
   * Naming the boundary makes everything inside it more credible, not less.
   */
  role: string;

  problem: string;
  constraints: string[];
  decisions: Decision[];
  tradeoffs: Tradeoff[];
  outcomes: Metric[];
  /** What would be done differently. Absence of this section reads as inexperience. */
  lessons: string[];
  stack: string[];
  links: ProjectLink[];

  /**
   * Scaffolding content that must never reach production. The content test fails the
   * build when STRICT_CONTENT is set and any of these survive.
   */
  placeholder?: true;
}
