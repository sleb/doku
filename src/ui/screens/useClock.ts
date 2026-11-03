import { useEffect } from "react";
import { gameStore, onClockFlush, useGameStore } from "../../store/gameStore";

const INTERVAL_MS = 500;
/** A gap longer than this is a suspension (sleep, frozen webview), not play. */
const MAX_GAP_MS = 3 * INTERVAL_MS;

/**
 * Drives the store clock while playing. The interval only wakes the hook; the
 * time added is the `performance.now()` delta, so a late interval loses none.
 * Pause, hint and face placement flush the partial interval first, so leaving
 * `playing` (pause, win, loss) loses none either. A gap over `MAX_GAP_MS` is a
 * suspension the page never saw (no blur or visibilitychange): it credits one
 * interval instead of the whole gap.
 */
export function useClock(): void {
  const playing = useGameStore((s) => s.status === "playing");
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const credit = () => {
      const now = performance.now();
      const gap = now - last;
      gameStore.getState().tick(gap > MAX_GAP_MS ? INTERVAL_MS : gap);
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
