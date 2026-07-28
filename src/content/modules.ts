export interface ModuleDescriptor {
  href: string;
  index: string;
  label: string;
}

/** The system's own map of itself. Nav, transitions and the palette all read from it. */
export const MODULES: ModuleDescriptor[] = [
  { href: "/", index: "01", label: "System" },
  { href: "/work", index: "02", label: "Work" },
  { href: "/path", index: "03", label: "Path" },
  { href: "/control", index: "04", label: "Control" },
  { href: "/signal", index: "05", label: "Signal" },
  // Listed as a module so the nav, the command palette and the transition overlay all
  // pick it up from one place. It is the single thing a recruiter came for, and it
  // should never be more than one click away from anywhere on the site.
  { href: "/resume", index: "06", label: "CV" },
];

export const LAB = { href: "/lab/control", index: "—", label: "Control rig" };

/** Longest-prefix match, so /work/some-project still resolves to Work. */
export function moduleForPath(pathname: string): ModuleDescriptor {
  if (pathname.startsWith(LAB.href)) return LAB;

  let best = MODULES[0];
  for (const entry of MODULES) {
    if (entry.href === "/") continue;
    if (pathname.startsWith(entry.href) && entry.href.length > best.href.length) {
      best = entry;
    }
  }
  return best;
}
