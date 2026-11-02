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
  const flushNow = () => {
    clearTimeout(timer);
    write();
    storage.flush().catch(() => {});
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flushNow();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", flushNow);
  const unsubscribe = gameStore.subscribe((s, prev) => {
    const changed =
      s.board !== prev.board ||
      s.hearts !== prev.hearts ||
      s.status !== prev.status ||
      ("wrong" in s && "wrong" in prev && s.wrong !== prev.wrong) ||
      ("hintsUsed" in s && "hintsUsed" in prev && s.hintsUsed !== prev.hintsUsed);
    if (!changed) return;
    if (toSaved(s) === null) {
      // Finished or idle: a late debounced write must not resurrect a save.
      clearTimeout(timer);
      storage.remove(KEY).catch(() => {});
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(write, debounceMs);
  });
  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", flushNow);
    clearTimeout(timer);
  };
}
