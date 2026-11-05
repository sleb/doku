import { useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { haptics } from "../../platform/haptics";
import { type GameStore, gameStore } from "../../store/gameStore";
import { settingsStore } from "../../store/settings";

/**
 * Drives the hold haptic build-up from the board's glow: returns the
 * `onHoldGlow` handler. The ramp starts with the glow (never on a tap) and
 * is cancelled when the glow ends, the game leaves `playing`, or on unmount.
 */
export function useHoldRamp(
  store: StoreApi<GameStore> = gameStore,
): (cell: number | null) => void {
  const cancelRef = useRef<(() => void) | null>(null);
  const status = useStore(store, (s) => s.status);
  const cancel = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);
  useEffect(() => {
    if (status !== "playing") cancel();
  }, [status, cancel]);
  useEffect(() => cancel, [cancel]);
  return useCallback(
    (cell) => {
      cancel();
      if (cell !== null && settingsStore.getState().haptics)
        cancelRef.current = haptics.ramp();
    },
    [cancel],
  );
}
