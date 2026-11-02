import type { Storage } from "../platform/storage";
import { gameStore } from "../store/gameStore";
import { toSaved } from "../store/persist";

const KEY = "save";

/** Saves the game on change (debounced); returns the teardown. */
export function installAutosave(
  storage: Storage,
  { debounceMs = 250 }: { debounceMs?: number } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const write = () => {
    const saved = toSaved(gameStore.getState());
    if (saved) storage.set(KEY, saved).catch(() => {});
  };
  const unsubscribe = gameStore.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(write, debounceMs);
  });
  return () => {
    unsubscribe();
    clearTimeout(timer);
  };
}
