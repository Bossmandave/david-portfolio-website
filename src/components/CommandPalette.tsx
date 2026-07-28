"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EMAIL } from "@/content/contact";
import { LAB, MODULES } from "@/content/modules";
import { PROJECTS } from "@/content/projects";
import { useModuleTransition } from "@/engine/transition/TransitionProvider";

interface Command {
  id: string;
  group: "Modules" | "Work" | "Actions";
  label: string;
  hint?: string;
  /** Extra terms that should match, without appearing in the label. */
  keywords?: string;
  run: (context: { go: (href: string) => void }) => void | Promise<void>;
}

function buildCommands(): Command[] {
  return [
    ...MODULES.map<Command>((module) => ({
      id: `module-${module.href}`,
      group: "Modules",
      label: module.label,
      hint: module.index,
      keywords: module.href,
      run: ({ go }) => go(module.href),
    })),
    {
      id: "lab",
      group: "Modules",
      label: LAB.label,
      hint: "instrument",
      keywords: "pid tuning rig oscilloscope gains",
      run: ({ go }) => go(LAB.href),
    },
    ...PROJECTS.map<Command>((project) => ({
      id: `work-${project.slug}`,
      group: "Work",
      label: project.title,
      hint: project.year,
      keywords: `${project.domains.join(" ")} ${project.stack.join(" ")}`,
      run: ({ go }) => go(`/work/${project.slug}`),
    })),
    {
      id: "copy-email",
      group: "Actions",
      label: "Copy email address",
      hint: EMAIL,
      keywords: "contact mail reach",
      run: async () => {
        await navigator.clipboard.writeText(EMAIL);
      },
    },
    {
      id: "github",
      group: "Actions",
      label: "Open GitHub",
      hint: "Bossmandave",
      keywords: "code repository source",
      run: () => {
        window.open("https://github.com/Bossmandave", "_blank", "noopener,noreferrer");
      },
    },
  ];
}

/** Substring match across label, hint and hidden keywords — predictable beats clever. */
function matches(command: Command, query: string): boolean {
  if (!query) return true;
  const haystack =
    `${command.label} ${command.hint ?? ""} ${command.keywords ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

export function CommandPalette() {
  const { go } = useModuleTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const commands = useMemo(() => buildCommands(), []);
  const results = useMemo(
    () => commands.filter((command) => matches(command, query)),
    [commands, query],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
    restoreFocus.current?.focus();
  }, []);

  const runCommand = useCallback(
    async (command: Command) => {
      close();
      await command.run({ go });
      if (command.id === "copy-email") {
        setFlash("Email copied");
        window.setTimeout(() => setFlash(null), 1800);
      }
    },
    [close, go],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        restoreFocus.current = document.activeElement as HTMLElement | null;
        setOpen((current) => !current);
      }
    };

    // A custom event rather than a shared context: the trigger lives in the nav, the
    // palette lives in the root layout, and neither should have to know the other
    // exists to work.
    const onRequest = () => {
      restoreFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("palette:open", onRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("palette:open", onRequest);
    };
  }, []);

  // Focus the field and stop the page behind from scrolling while the dialog owns
  // the screen. Restoring the previous overflow rather than clearing it avoids
  // stomping on anything else that may have set it.
  useEffect(() => {
    if (!open) return;

    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // The selection resets where the query actually changes, rather than in an effect
  // reacting to it afterwards — one render instead of two, and no intermediate frame
  // where the highlight points at a row the filter has already removed.
  const onQueryChange = (value: string) => {
    setQuery(value);
    setIndex(0);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setIndex(results.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[index];
      if (command) void runCommand(command);
    } else if (event.key === "Tab") {
      // The dialog holds exactly one focusable control, so the trap is a single line.
      event.preventDefault();
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [index, results.length]);

  return (
    <>
      {/* Announced out of band, because the dialog has already closed by the time a
          copy succeeds and there is nothing left on screen to read. */}
      <div aria-live="polite" className="sr-only">
        {flash ?? ""}
      </div>

      {flash ? (
        <div className="fixed bottom-6 left-1/2 z-60 -translate-x-1/2 border border-response/40 bg-void px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-response uppercase">
          {flash}
        </div>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-60 flex items-start justify-center bg-void/70 px-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-[520px] border border-line-bright bg-panel shadow-[0_30px_80px_-30px_#000]"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <span aria-hidden className="font-mono text-[11px] text-ink-faint">
                ›
              </span>
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-results"
                aria-activedescendant={results[index] ? `cmd-${results[index].id}` : undefined}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                placeholder="Jump to a module, a project, or an action"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={onKeyDown}
                className="w-full bg-transparent py-3.5 font-mono text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <kbd className="hidden shrink-0 border border-line-bright px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] text-ink-faint sm:block">
                ESC
              </kbd>
            </div>

            <ul
              ref={listRef}
              id="palette-results"
              role="listbox"
              aria-label="Results"
              className="max-h-[46vh] overflow-y-auto py-1.5"
            >
              {results.length === 0 ? (
                <li className="px-4 py-6 text-center font-mono text-[11px] text-ink-faint">
                  Nothing matches that.
                </li>
              ) : (
                results.map((command, position) => {
                  const selected = position === index;
                  const first =
                    position === 0 || results[position - 1].group !== command.group;

                  return (
                    <li key={command.id}>
                      {first ? (
                        <p className="px-4 pt-3 pb-1.5 font-mono text-[9px] tracking-[0.24em] text-ink-faint uppercase">
                          {command.group}
                        </p>
                      ) : null}
                      <div
                        id={`cmd-${command.id}`}
                        role="option"
                        aria-selected={selected}
                        onMouseEnter={() => setIndex(position)}
                        onClick={() => void runCommand(command)}
                        className={`flex cursor-pointer items-baseline justify-between gap-4 px-4 py-2 ${
                          selected ? "bg-response/10 text-response" : "text-ink-dim"
                        }`}
                      >
                        <span className="truncate font-mono text-[13px]">
                          {command.label}
                        </span>
                        {command.hint ? (
                          <span className="shrink-0 truncate font-mono text-[10px] text-ink-faint tabular-nums">
                            {command.hint}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
