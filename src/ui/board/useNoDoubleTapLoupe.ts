import { type RefObject, useEffect, useRef } from "react";

/** A touch starting this soon after the previous one ended counts as a double-tap. */
export const DOUBLE_TAP_MS = 400;

/**
 * iOS starts its text-selection loupe from a double-tap-then-hold, even with
 * `user-select: none`, and nothing in CSS stops it. Cancelling the second
 * touchstart does; that also suppresses the browser's click, so the tap is
 * replayed as a click on release (only if it ends on the cell it began on).
 * Pointer events are unaffected, so the hold gesture still works.
 */
export function useNoDoubleTapLoupe<T extends HTMLElement>(
  now: () => number = () => performance.now(),
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const clock = useRef(now);
  clock.current = now;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let lastEnd = Number.NEGATIVE_INFINITY;
    let replay: HTMLButtonElement | null = null;
    const onStart = (e: TouchEvent) => {
      replay = null;
      if (e.touches.length !== 1 || clock.current() - lastEnd >= DOUBLE_TAP_MS)
        return;
      e.preventDefault();
      replay = (e.target as Element).closest("button");
    };
    const onEnd = (e: TouchEvent) => {
      lastEnd = clock.current();
      const button = replay;
      replay = null;
      const t = e.changedTouches[0];
      if (!button || !t || button.disabled) return;
      const hit = document.elementFromPoint(t.clientX, t.clientY);
      if (hit?.closest("button") === button) button.click();
    };
    const onCancel = () => {
      replay = null;
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, []);
  return ref;
}
