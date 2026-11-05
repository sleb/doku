import { useEffect } from "react";
import type { StoreApi } from "zustand/vanilla";
import { haptics } from "../../platform/haptics";
import { outcomeFor } from "../../platform/outcome";
import type { GameStore } from "../../store/gameStore";
import { gameStore } from "../../store/gameStore";
import { settingsStore } from "../../store/settings";

/** Plays feedback for the outcome of each store change. Subscribes once. */
export function useFeedback(store: StoreApi<GameStore> = gameStore) {
  useEffect(
    () =>
      store.subscribe((next, prev) => {
        const outcome = outcomeFor(prev, next);
        if (outcome && settingsStore.getState().haptics)
          void haptics.play(outcome.kind);
      }),
    [store],
  );
}
