"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";

import type { Shot } from "@/content/types";
import { SecondOrder } from "@/core/control/second-order";
import { MOTION, resolveMotion } from "@/design/motion";
import { useRender, useSimulate } from "@/engine/runtime/RuntimeProvider";
import { useReducedMotion } from "@/engine/runtime/useReducedMotion";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Every tile is the same height, and the image fits inside it.
 *
 * Sizing thumbnails by column width does not survive mixed aspect ratios. A phone
 * capture is roughly 9:19.5, so in a half-width column of a 1120px measure it renders
 * past a thousand pixels tall — one screenshot filling more than a full screen, next to
 * a desktop capture a third of the height. Constraining the height instead makes the
 * portrait shot narrow rather than enormous, and the section reads as a contact sheet:
 * an index you scan, with the artefact one click away.
 */
const TILE_HEIGHT = "h-40 sm:h-52 lg:h-60";

/**
 * Because the height is fixed, the *displayed* width is height × aspect — not a share
 * of the viewport. Handing `sizes` a `vw` value here would have the browser fetch a file
 * several times larger than the box, worst of all for the portrait shots that occupy the
 * least width. These are the widths the box actually resolves to; the srcset still
 * covers high-DPR screens on top.
 */
function sizesFor(landscape: boolean): string {
  return landscape ? "400px" : "220px";
}

/**
 * Screens, with a lightbox that exists for a reason.
 *
 * Interface screenshots are mostly text, and text in a thumbnail is a grey smear. So the
 * grid is the index and the overlay is the actual artefact — without it the section
 * would be decoration, which is the failure mode of every portfolio gallery.
 *
 * The overlay is a native `<dialog>` opened with `showModal()`, not a div with a high
 * z-index. That buys the focus trap, the inert background, Escape, and focus returning
 * to the thumbnail you came from — all behaviours a hand-rolled modal reimplements
 * badly. What is left to write is the part the platform does not have an opinion about:
 * arrow-key paging, and an entrance that obeys the same physics as the rest of the site.
 */
export function Gallery({ shots }: { shots: Shot[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Mutable by nature, so it lives in a ref rather than in state — it holds three
  // numbers and is stepped by the simulation loop, never by React.
  const entrance = useRef(
    new SecondOrder(MOTION.commit.zeta, MOTION.commit.omegaN, 0),
  );
  const lastRendered = useRef(-1);

  const isOpen = openIndex !== null;
  const active = openIndex === null ? null : shots[openIndex];

  useEffect(() => {
    const token = resolveMotion(MOTION.commit, reducedMotion);
    entrance.current.zeta = token.zeta;
    entrance.current.omegaN = token.omegaN;
  }, [reducedMotion]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      // Reset before showing, or a second opening starts from wherever the last one
      // finished and the entrance never plays.
      entrance.current.snap(0);
      lastRendered.current = -1;
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  /**
   * `showModal` makes the page inert but not unscrollable, so a wheel gesture still
   * moves the case study behind the overlay. Two lines here, or a confusing overlay.
   */
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useSimulate((dt) => {
    const spring = entrance.current;
    spring.target = isOpen ? 1 : 0;
    // Closed and at rest is the common case on every case-study page. Bail before doing
    // arithmetic for an overlay nobody has opened.
    if (spring.settled) {
      spring.value = spring.target;
      spring.velocity = 0;
      return;
    }
    spring.step(dt);
  });

  useRender(() => {
    const node = panelRef.current;
    if (!node) return;

    const value = entrance.current.value;
    if (Math.abs(value - lastRendered.current) < 0.001) return;
    lastRendered.current = value;

    const progress = Math.min(1, Math.max(0, value));
    node.style.opacity = progress.toFixed(3);
    node.style.transform = `scale(${(0.97 + 0.03 * progress).toFixed(4)})`;
  });

  const step = useCallback(
    (delta: number) => {
      setOpenIndex((current) =>
        current === null
          ? current
          : (current + delta + shots.length) % shots.length,
      );
    },
    [shots.length],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (shots.length < 2) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  };

  // A click that lands on the dialog element itself landed on the backdrop — anything
  // inside the panel has a nearer target.
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) setOpenIndex(null);
  };

  return (
    <>
      <ul className="grid gap-px bg-line sm:grid-cols-2">
        {shots.map((shot, index) => {
          const landscape = shot.width >= shot.height;
          return (
            <li key={shot.src} className="bg-void p-3 sm:p-4">
              <figure className="break-inside-avoid">
                <button
                  type="button"
                  onClick={() => setOpenIndex(index)}
                  className={`group relative flex w-full cursor-zoom-in items-center justify-center overflow-hidden border border-line bg-panel transition-colors hover:border-line-bright focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-response ${TILE_HEIGHT}`}
                >
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={shot.width}
                    height={shot.height}
                    sizes={sizesFor(landscape)}
                    className="h-full w-auto max-w-full object-contain"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-2 bottom-2 border border-line-bright bg-void/80 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.18em] text-ink-dim uppercase opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    Enlarge
                  </span>
                  <span className="sr-only">Enlarge screenshot</span>
                </button>

                <figcaption className="mt-3 grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 text-[13px] leading-[1.55] text-ink-dim">
                  <span
                    aria-hidden
                    className="pt-[0.15rem] font-mono text-[10px] tracking-[0.14em] text-ink-faint tabular-nums"
                  >
                    {pad(index + 1)}
                  </span>
                  <span>{shot.caption}</span>
                </figcaption>
              </figure>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpenIndex(null)}
        onKeyDown={onKeyDown}
        onClick={onBackdropClick}
        aria-label="Screenshot viewer"
        className="gallery-dialog"
      >
        {active ? (
          <div
            ref={panelRef}
            className="flex h-full w-full flex-col"
            style={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <p className="font-mono text-[10px] tracking-[0.18em] text-ink-faint uppercase tabular-nums">
                {pad((openIndex ?? 0) + 1)} / {pad(shots.length)}
              </p>
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                className="border border-line px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-ink-dim uppercase transition-colors hover:border-line-bright hover:text-ink focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-response"
              >
                Close <span aria-hidden>esc</span>
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center px-4 sm:px-6">
              <Image
                key={active.src}
                src={active.src}
                alt={active.alt}
                width={active.width}
                height={active.height}
                quality={92}
                sizes="100vw"
                className="h-auto max-h-full w-auto max-w-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-6">
              <p className="max-w-[62ch] text-[13px] leading-[1.55] text-ink-dim">
                {active.caption}
              </p>

              {shots.length > 1 ? (
                <div className="flex shrink-0 gap-px bg-line">
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    aria-label="Previous screenshot"
                    className="bg-void px-4 py-2 font-mono text-[13px] text-ink-dim transition-colors hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-response"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    aria-label="Next screenshot"
                    className="bg-void px-4 py-2 font-mono text-[13px] text-ink-dim transition-colors hover:text-response focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-response"
                  >
                    →
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
