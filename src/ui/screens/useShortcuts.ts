import { type RefObject, useEffect } from "react";
import { gameStore } from "../../store/gameStore";

/**
 * z / Ctrl-or-Cmd+Z undo; Shift+Z / Ctrl-or-Cmd+Shift+Z / Ctrl+Y (every platform)
 * redo; plain h takes a hint. Only while playing. #80 folds this into useShortcuts.
 */
export interface ShortcutOptions {
  /** The board's hold owner: while a cell is held, undo/redo/hint do nothing. */
  holdOwner?: RefObject<number | null>;
}

export function useShortcuts({ holdOwner }: ShortcutOptions = {}): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey) return;
      if (gameStore.getState().status !== "playing") return;
      const key = e.key.toLowerCase();
      let action: "undo" | "redo" | "hint" | "pause" | null = null;
      if (key === "escape") action = "pause";
      else if (key === "z") action = e.shiftKey ? "redo" : "undo";
      else if (key === "h" && !e.ctrlKey && !e.metaKey) action = "hint";
      else if (key === "y" && e.ctrlKey && !e.metaKey) action = "redo";
      if (!action) return;
      if (action !== "pause" && holdOwner?.current != null) return;
      e.preventDefault();
      gameStore.getState()[action]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [holdOwner]);
}
