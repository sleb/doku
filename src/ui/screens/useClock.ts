import { useEffect } from "react";
import { gameStore, useGameStore } from "../../store/gameStore";

const INTERVAL_MS = 500;

/**
 * Drives the store clock while playing. The interval only wakes the hook; the
 * time added is the `performance.now()` delta, so a late interval loses none.
 */
export function useClock(): void {
  const playing = useGameStore((s) => s.status === "playing");
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      gameStore.getState().tick(now - last);
      last = now;
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing]);
}
