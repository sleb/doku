import { useEffect } from "react";
import type { StoreApi } from "zustand/vanilla";
import { haptics } from "../../platform/haptics";
import { outcomeFor } from "../../platform/outcome";
import { sound } from "../../platform/sound";
import { type GameStore, gameStore } from "../../store/gameStore";
import { settingsStore } from "../../store/settings";

/** Plays feedback for the outcome of each store change. Subscribes once. */
export function useFeedback(store: StoreApi<GameStore> = gameStore) {
  useEffect(
    () =>
      store.subscribe((next, prev) => {
        const outcome = outcomeFor(prev, next);
        if (!outcome) return;
        const settings = settingsStore.getState();
        if (settings.haptics) void haptics.play(outcome.kind);
        if (settings.sound && next.level)
          void sound.play(outcome.kind, outcome.faces, next.level.size);
      }),
    [store],
  );

  // Audio starts suspended until a user-activation gesture (pointerdown is
  // not one on touch). Keep trying until the context is actually running.
  useEffect(() => {
    const events = ["pointerup", "touchend", "click", "keydown"] as const;
    const remove = () => {
      for (const e of events) window.removeEventListener(e, unlock);
    };
    const unlock = () => {
      void sound.unlock().then((running) => {
        if (running) remove();
      });
    };
    for (const e of events) window.addEventListener(e, unlock);
    const suspend = () => sound.suspend();
    const onVisibility = () =>
      document.visibilityState === "hidden" ? sound.suspend() : sound.resume();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", suspend);
    return () => {
      remove();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", suspend);
    };
  }, []);
}
