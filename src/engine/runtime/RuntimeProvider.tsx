"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Runtime, type RenderFn, type SimulateFn } from "@/engine/runtime/runtime";

const RuntimeContext = createContext<Runtime | null>(null);

export function RuntimeProvider({
  children,
  hz = 240,
}: {
  children: ReactNode;
  hz?: number;
}) {
  const [runtime] = useState(() => new Runtime(hz));

  useEffect(() => {
    runtime.start();

    // A backgrounded tab still fires rAF in some browsers and not others; stopping
    // explicitly keeps behaviour identical everywhere and stops burning battery on a
    // simulation nobody is looking at.
    const onVisibilityChange = () => {
      if (document.hidden) runtime.stop();
      else runtime.start();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      runtime.stop();
    };
  }, [runtime]);

  return (
    <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>
  );
}

export function useRuntime(): Runtime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) {
    throw new Error("useRuntime must be used inside a <RuntimeProvider>");
  }
  return runtime;
}

/**
 * Keeps a ref pointing at the newest callback without re-subscribing.
 *
 * The update happens in an effect rather than during render because a render can be
 * thrown away under concurrent rendering — writing the ref there would publish a
 * callback belonging to a version of the tree that never committed.
 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Subscribe to the fixed-timestep simulation.
 *
 * The subscription registers once and never tears down, so a component can close over
 * changing props without the loop resubscribing — or dropping a frame — every render.
 */
export function useSimulate(fn: SimulateFn): void {
  const runtime = useRuntime();
  const ref = useLatest(fn);

  useEffect(
    () => runtime.onSimulate((dt) => ref.current(dt)),
    [runtime, ref],
  );
}

/** Subscribe to the per-frame render pass. Same discipline as `useSimulate`. */
export function useRender(fn: RenderFn): void {
  const runtime = useRuntime();
  const ref = useLatest(fn);

  useEffect(
    () => runtime.onRender((frame) => ref.current(frame)),
    [runtime, ref],
  );
}
