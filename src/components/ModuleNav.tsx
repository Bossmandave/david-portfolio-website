"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MODULES } from "@/content/modules";

export function ModuleNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Modules"
      className="sticky top-0 z-20 border-b border-line bg-void/85 backdrop-blur-sm"
    >
      <div className="mx-auto flex h-12 max-w-[1120px] items-center justify-between gap-6 px-4 sm:px-10">
        {/* Hidden below `sm`, where the five module links need the full width and the
            wordmark would be pure duplication — "System" is already the link home.
            Preferred over a hamburger: five short labels do not earn a drawer, and
            hiding them behind one costs a tap for no gain. */}
        <Link
          href="/"
          className="hidden min-w-0 truncate font-mono text-[11px] tracking-[0.22em] text-ink uppercase transition-colors hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-response sm:block"
        >
          David Uchenna Agodi
        </Link>

        <ul className="flex w-full items-center justify-between gap-3 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-5">
          {MODULES.map((module) => {
            const active =
              module.href === "/"
                ? pathname === "/"
                : pathname.startsWith(module.href);

            return (
              <li key={module.href}>
                <Link
                  href={module.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-baseline gap-1.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-response ${
                    active ? "text-response" : "text-ink-dim hover:text-ink"
                  }`}
                >
                  <span className="hidden text-ink-faint sm:inline">
                    {module.index}
                  </span>
                  {module.label}
                </Link>
              </li>
            );
          })}

          {/* A shortcut nobody knows about is a shortcut nobody uses. */}
          <li className="hidden md:block">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("palette:open"))}
              aria-label="Open command palette"
              className="flex items-center gap-1 border border-line-bright px-1.5 py-0.5 font-mono text-[10px] tracking-[0.1em] text-ink-faint transition-colors hover:border-response/60 hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-response"
            >
              <span aria-hidden>⌘</span>K
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
