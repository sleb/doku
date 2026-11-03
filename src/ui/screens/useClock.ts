import { useEffect } from "react";
import { gameStore, onClockFlush, useGameStore } from "../../store/gameStore";

const INTERVAL_MS = 500;

/**
 * Drives the store clock while playing. The interval only wakes the hook; the
 * time added is the `performance.now()` delta, so a late interval loses none.
 * Pause, hint and face placement flush the partial interval first, so leaving
 * `playing` (pause, win, loss) loses none either.
 */
export function useClock(): void {
  const playing = useGameStore((s) => s.status === "playing");
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const credit = () => {
      const now = performance.now();
      gameStore.getState().tick(now - last);
      last = now;
    };
    const id = setInterval(credit, INTERVAL_MS);
    const unregister = onClockFlush(credit);
    return () => {
      clearInterval(id);
      unregister();
    };
  }, [playing]);
}
