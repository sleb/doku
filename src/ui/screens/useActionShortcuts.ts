import { useEffect } from "react";
import { gameStore } from "../../store/gameStore";

/**
 * z / Ctrl-or-Cmd+Z undo; Shift+Z / Ctrl-or-Cmd+Shift+Z / Ctrl+Y (every platform)
 * redo; plain h takes a hint. Only while playing. #80 folds this into useShortcuts.
 */
export function useActionShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey) return;
      if (gameStore.getState().status !== "playing") return;
      const key = e.key.toLowerCase();
      let action: "undo" | "redo" | "hint" | null = null;
      if (key === "z") action = e.shiftKey ? "redo" : "undo";
      else if (key === "h" && !e.ctrlKey && !e.metaKey) action = "hint";
      else if (key === "y" && e.ctrlKey && !e.metaKey) action = "redo";
      if (!action) return;
      e.preventDefault();
      gameStore.getState()[action]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
