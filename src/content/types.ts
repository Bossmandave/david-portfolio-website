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

/**
 * Work on the same product that is real but is not the argument.
 *
 * A case study should make one point properly. Everything else a person built on a
 * large product still deserves stating — it is usually the bulk of the work — but
 * forcing each item into a decision-and-trade-off shape either inflates it or buries
 * the thing the study is actually about. This gets its own section and its own
 * register: what it is, why it was not trivial, and then stop.
 */
export interface Contribution {
  title: string;
  body: string;
}

/**
 * One screen, plus the sentence that turns it into evidence.
 *
 * `caption` is required for the same reason `Metric.caveat` is: a screenshot on a
 * portfolio invites the reader to assume every pixel in it is yours, and a wall of
 * uncaptioned screens makes that claim silently. The caption is where the boundary gets
 * said out loud — what this screen is, and which part of it you built.
 *
 * `width` and `height` are the file's *intrinsic* pixels, not a display size. They exist
 * so the browser can reserve the correct box before a single byte of image arrives; a
 * gallery that reflows as it loads is the easiest way to wreck Cumulative Layout Shift
 * on a page that is otherwise static text. The content test reads the real file header,
 * so these cannot drift out of sync with the asset without the build saying so.
 */
export interface Shot {
  /** Path under `public/`, e.g. `/shots/nivram/thread.png`. */
  src: string;
  /** What a screen-reader user is told the screen shows. Not the filename. */
  alt: string;
  /** What the reader is looking at, and whose work it is. */
  caption: string;
  width: number;
  height: number;
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

/**
 * Work that shipped, without the case-study apparatus.
 *
 * A deliberately separate type, because these make a different claim. A featured case
 * study argues *how you think* — the constraint, the decision that could have gone the
 * other way, what it cost. This tier argues *that you ship*: real briefs, real
 * stakeholders, live URLs.
 *
 * Keeping them apart is what stops both failure modes. Padding a two-week client site
 * into a false depth is impossible because the fields do not exist; and the featured
 * tier cannot quietly fill up with thin entries, because moving one there means
 * answering the hard questions the other type demands.
 */
export interface Shipped {
  name: string;
  /** One line. Resist the second. */
  summary: string;
  year: string;
  /** Who it was for, plainly: "Client work", "Personal", "Open source". */
  context: string;
  stack: string[];
  href?: string;
  repo?: string;
  placeholder?: true;
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
  /** Other work on the same product, kept out of the main argument on purpose. */
  alsoBuilt?: Contribution[];
  /**
   * Screens, on the detail page only. The index stays typographic on purpose — a grid
   * of thumbnails there would turn a set of arguments into a set of thumbnails, and the
   * reader would pick by prettiest rather than by what the work was.
   */
  gallery?: Shot[];
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
