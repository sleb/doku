import { type RefObject, useEffect } from "react";
import type { StoreApi } from "zustand/vanilla";
import { type GameStore, gameStore } from "../../store/gameStore";
import { settingsStore } from "../../store/settings";

export interface ShortcutOptions {
  /** The store the keys drive. Defaults to the app's game store. */
  store?: StoreApi<GameStore>;
  /** Whether Esc pauses. Default true; the tutorial has no pause. */
  pause?: boolean;
  /** Which of undo, redo and hint respond. Default all. */
  only?: readonly ("undo" | "redo" | "hint")[];
  /** The board's hold owner: while a cell is held, undo/redo/hint do nothing. */
  holdOwner?: RefObject<number | null>;
}

/**
 * Window shortcuts, active only while playing: z / Ctrl-or-Cmd+Z undo;
 * Shift+Z / Ctrl-or-Cmd+Shift+Z / Ctrl+Y redo; h hint; f (any case, no Shift) toggles whether a tap places faces, only when
 * pause and all of undo, redo and hint are enabled; Esc pause. Undo, redo
 * and hint do nothing during a hold; Esc still pauses.
 */
export function useShortcuts({
  holdOwner,
  store = gameStore,
  pause = true,
  only = ["undo", "redo", "hint"],
}: ShortcutOptions = {}): void {
  // Compared by content, so an inline array does not rebind the listener.
  const allowed = only.join();
  const fullControls =
    pause &&
    ["undo", "redo", "hint"].every((c) => allowed.split(",").includes(c));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A dialog that already handled the key (Esc closing it) owns it.
      if (e.defaultPrevented || e.repeat || e.altKey) return;
      if (store.getState().status !== "playing") return;
      const key = e.key.toLowerCase();
      if (key === "f" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Part of the full control set: a restricted screen (the tutorial)
        // must not change the mode behind its back.
        if (!fullControls) return;
        e.preventDefault();
        const { inputMode, set } = settingsStore.getState();
        set({ inputMode: inputMode === "face" ? "mark" : "face" });
        return;
      }
      let action: "undo" | "redo" | "hint" | "pause" | null = null;
      if (key === "escape" && !e.ctrlKey && !e.metaKey) action = "pause";
      else if (key === "z") action = e.shiftKey ? "redo" : "undo";
      else if (key === "h" && !e.ctrlKey && !e.metaKey) action = "hint";
      else if (key === "y" && e.ctrlKey && !e.metaKey) action = "redo";
      if (!action) return;
      if (action === "pause" ? !pause : !allowed.split(",").includes(action))
        return;
      if (action !== "pause" && holdOwner?.current != null) return;
      e.preventDefault();
      store.getState()[action]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [holdOwner, store, pause, allowed, fullControls]);
}
