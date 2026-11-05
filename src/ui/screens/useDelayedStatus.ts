import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../../app/motion";
import type { GameStatus } from "../../store/game";

/** How long the win wave plays before the result modal opens. */
export const WIN_DELAY_MS = 900;
/** How long the final wrong-tap effect plays before the result modal opens. */
export const LOSE_DELAY_MS = 450;

/** Keys that never skip: modifiers, and focus/dismiss keys. */
const NO_SKIP = new Set(["Shift", "Control", "Alt", "Meta", "Tab", "Escape"]);
/** Keys that activate a focused button. */
const ACTIVATE = new Set([" ", "Enter"]);

/**
 * The skip key is pressed while the result modal's button is about to take
 * focus: swallow its keyup (which would click that button) once released.
 */
function swallowKeyUp(key: string) {
  const onUp = (e: KeyboardEvent) => {
    if (e.key !== key) return;
    e.preventDefault();
    e.stopPropagation();
    window.removeEventListener("keyup", onUp, true);
  };
  window.addEventListener("keyup", onUp, true);
}

/**
 * The status to display: a `won`/`lost` is held back (the previous status is
 * returned) for `winMs`/`loseMs`, or until `skip()` or a key press. Other
 * statuses and a final status present on mount pass through immediately; under
 * reduced motion there is no delay.
 */
export function useDelayedStatus(
  status: GameStatus,
  winMs: number,
  loseMs: number,
): { status: GameStatus; pending: boolean; skip: () => void } {
  const [shown, setShown] = useState(status);
  const final = status === "won" || status === "lost";
  const delay = prefersReducedMotion() ? 0 : status === "won" ? winMs : loseMs;
  // State adjusted in render: anything but a delayed final status shows now.
  if (shown !== status && (!final || delay === 0)) setShown(status);
  const pending = final && shown !== status && delay > 0;

  useEffect(() => {
    if (!pending) return;
    const release = () => setShown(status);
    const timer = setTimeout(release, delay);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || NO_SKIP.has(e.key)) return;
      if (ACTIVATE.has(e.key)) {
        e.preventDefault();
        swallowKeyUp(e.key);
      }
      release();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [pending, status, delay]);

  return {
    status: pending ? shown : status,
    pending,
    skip: () => setShown(status),
  };
}
