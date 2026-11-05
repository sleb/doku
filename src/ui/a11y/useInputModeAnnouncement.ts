import { useEffect } from "react";
import { settingsStore } from "../../store/settings";
import { announceInputMode } from "./announce";
import { announcerStore } from "./announcerStore";

/** Announces tap-mode changes, whoever writes them (key, action bar, settings). */
export function useInputModeAnnouncement() {
  useEffect(
    () =>
      settingsStore.subscribe((next, prev) => {
        if (next.inputMode !== prev.inputMode)
          announcerStore.getState().say(announceInputMode(next.inputMode));
      }),
    [],
  );
}
