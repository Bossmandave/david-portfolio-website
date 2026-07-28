export interface PointerState {
  /** Position in the tracked element's local coordinate space, pixels. */
  x: number;
  y: number;
  /** False before the first move, and after the pointer leaves the window. */
  active: boolean;
  /**
   * True between a press that began inside the tracked element and its release.
   *
   * A finger has no hover state, so `active` — which means "has moved at least
   * once" — is not enough to know whether someone is currently commanding
   * anything. Touch interaction needs to know about contact, not presence.
   */
  pressed: boolean;
  /** True for coarse pointers, where hover-driven interaction does not apply. */
  coarse: boolean;
}

/**
 * Tracks the pointer in an element's local coordinates, without React state.
 *
 * The setpoint of a control loop updates every frame; routing that through `useState`
 * would re-render the tree sixty times a second. This writes into a mutable object the
 * simulation reads directly.
 *
 * The element's rect is cached and refreshed on resize and scroll rather than measured
 * per event — `getBoundingClientRect` in a pointermove handler forces layout on every
 * mouse movement.
 */
export function trackPointer(
  element: HTMLElement,
  state: PointerState,
): () => void {
  let rect = element.getBoundingClientRect();

  const measure = () => {
    rect = element.getBoundingClientRect();
  };

  const track = (event: PointerEvent) => {
    state.x = event.clientX - rect.left;
    state.y = event.clientY - rect.top;
    state.active = true;
    state.coarse = event.pointerType !== "mouse";
  };

  const onPointerMove = track;

  // Bound on the element, so only a press that begins inside it counts as a command.
  const onPointerDown = (event: PointerEvent) => {
    measure();
    track(event);
    state.pressed = true;
  };

  // Released on the window: a drag that ends outside the element must still end.
  const onPointerUp = () => {
    state.pressed = false;
  };

  const onPointerLeave = () => {
    state.active = false;
  };

  const observer = new ResizeObserver(measure);
  observer.observe(element);

  element.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp, { passive: true });
  window.addEventListener("pointercancel", onPointerUp, { passive: true });
  window.addEventListener("scroll", measure, { passive: true });
  window.addEventListener("resize", measure);
  document.addEventListener("pointerleave", onPointerLeave);

  return () => {
    observer.disconnect();
    element.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    window.removeEventListener("scroll", measure);
    window.removeEventListener("resize", measure);
    document.removeEventListener("pointerleave", onPointerLeave);
  };
}

export function createPointerState(): PointerState {
  return { x: 0, y: 0, active: false, pressed: false, coarse: false };
}
