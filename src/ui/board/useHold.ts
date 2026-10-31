import { useCallback, useEffect, useRef, useState } from "react";
import { HOLD_DELAY_MS, HOLD_MS } from "./hold";

type Source = "pointer" | "key";

/**
 * Press-and-hold gesture. `start` arms the gesture: `holding` turns on after
 * HOLD_DELAY_MS (so a plain click never shows the glow) and the hold completes
 * HOLD_MS later. `cancel` disarms it.
 * On completion `onComplete` fires once. `swallowClick` reports (and resets)
 * whether a pointer hold just completed, so its trailing click can be ignored.
 */
export function useHold(onComplete: () => void, disabled: boolean) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const delay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const completed = useRef(false);
  const latest = useRef(onComplete);
  latest.current = onComplete;
  const off = useRef(disabled);
  off.current = disabled;

  const cancel = useCallback(() => {
    clearTimeout(delay.current);
    clearTimeout(timer.current);
    delay.current = undefined;
    timer.current = undefined;
    setHolding(false);
  }, []);

  const start = useCallback((source: Source) => {
    if (
      off.current ||
      delay.current !== undefined ||
      timer.current !== undefined
    )
      return;
    completed.current = false;
    delay.current = setTimeout(() => {
      delay.current = undefined;
      setHolding(true);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        completed.current = source === "pointer";
        setHolding(false);
        latest.current();
      }, HOLD_MS);
    }, HOLD_DELAY_MS);
  }, []);

  /** Forget a pending swallow when its trailing click can no longer come. */
  const clearSwallow = useCallback(() => {
    completed.current = false;
  }, []);

  const swallowClick = useCallback(() => {
    const was = completed.current;
    completed.current = false;
    return was;
  }, []);

  useEffect(() => {
    if (disabled) cancel();
  }, [disabled, cancel]);
  useEffect(
    () => () => {
      clearTimeout(delay.current);
      clearTimeout(timer.current);
    },
    [],
  );

  return { holding, start, cancel, clearSwallow, swallowClick };
}
