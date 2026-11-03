import type { Storage } from "../platform/storage";
import { gameStore } from "../store/gameStore";
import { toSaved } from "../store/persist";

const KEY = "save";
/** Play time between refreshes of the saved elapsed (ticks alone never write). */
const REFRESH_MS = 5000;

/** Saves the game on change (debounced); returns the teardown. */
export function installAutosave(
  storage: Storage,
  { debounceMs = 250 }: { debounceMs?: number } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let savedElapsed = 0;
  const write = () => {
    const saved = toSaved(gameStore.getState());
    if (!saved) return;
    savedElapsed = saved.elapsedMs;
    storage.set(KEY, saved).catch(() => {});
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      write();
    }, debounceMs);
  };
  const flushNow = () => {
    clearTimeout(timer);
    timer = undefined;
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
      ("hintsUsed" in s &&
        "hintsUsed" in prev &&
        s.hintsUsed !== prev.hintsUsed);
    if (!changed) {
      // A hard kill keeps only the last write, so refresh the elapsed while
      // playing, at most once per REFRESH_MS of play (not on every tick).
      if (
        s.status === "playing" &&
        s.elapsedMs - savedElapsed >= REFRESH_MS &&
        timer === undefined
      ) {
        schedule();
      }
      return;
    }
    if (toSaved(s) === null) {
      // Finished or idle: a late debounced write must not resurrect a save.
      clearTimeout(timer);
      timer = undefined;
      storage.remove(KEY).catch(() => {});
      return;
    }
    schedule();
  });
  return () => {
    unsubscribe();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", flushNow);
    clearTimeout(timer);
  };
}
