import { useEffect } from "react";
import { gameStore } from "../../store/gameStore";

/** Pause on hide, blur and Esc. Resume is never automatic. #80 folds Esc into useShortcuts. */
export function useAutoPause(): void {
  useEffect(() => {
    const pause = () => gameStore.getState().pause();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") pause();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pause);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pause);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}
