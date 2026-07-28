"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/**
 * The server cannot know the preference, so it assumes full motion and the client
 * corrects on hydration. Safe because reduced motion is a retune rather than a
 * different code path — one frame at the unreduced tuning changes nothing.
 */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * A media query is an external store, so it is read as one. `useEffect` plus
 * `setState` would work but schedules a second render on every mount purely to
 * report a value that was available synchronously.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
