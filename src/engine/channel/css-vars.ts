/**
 * Writes CSS custom properties, skipping values that have not changed.
 *
 * This is the whole React↔motion boundary. The loop writes a handful of numbers onto
 * one element; any number of components read them in CSS and move without re-rendering.
 * Setting a custom property to the value it already holds still costs a style
 * invalidation, so the last-written cache is not a micro-optimisation — at 60Hz across
 * five properties it is the difference between a quiet frame and a busy one.
 */
export function createVarWriter(element: HTMLElement) {
  const written = new Map<string, string>();

  return function write(name: string, value: string): void {
    if (written.get(name) === value) return;
    written.set(name, value);
    element.style.setProperty(name, value);
  };
}

export type VarWriter = ReturnType<typeof createVarWriter>;
