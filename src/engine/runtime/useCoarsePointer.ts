"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

function subscribe(onStoreChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** The server cannot know the input device; assume fine and correct on hydration. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * True where the primary input is a finger rather than a cursor.
 *
 * Interactions built on hover and continuous pointer position have no touch
 * equivalent, so the honest move is to detect that and give those devices a
 * different — not a degraded — version of the same idea.
 */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
