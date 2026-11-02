import { useEffect } from "react";
import { gameStore } from "../../store/gameStore";

/** Pause on hide and blur. Resume is never automatic. Esc is handled by useShortcuts. */
export function useAutoPause(): void {
  useEffect(() => {
    const pause = () => gameStore.getState().pause();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", pause);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", pause);
    };
  }, []);
}
