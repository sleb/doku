import { LEVELS, levelIndex } from "../levels/campaign";
import type { Storage } from "../platform/storage";
import { gameStore } from "../store/gameStore";
import { fromSaved } from "../store/persist";
import {
  currentLevel,
  hydrateProgress,
  persistProgress,
  progressStore,
} from "../store/progress";
import {
  hydrateSettings,
  persistSettings,
  settingsStore,
} from "../store/settings";
import { installAutosave } from "./autosave";
import { recordWins, startCurrent } from "./campaign";
import { applyTheme } from "./theme";

/** Loads saved state, then starts saving changes. Resolves before first paint. */
let teardown: Array<() => void> = [];

export async function boot(
  storage: Storage,
  { devLevel = null }: { devLevel?: number | null } = {},
): Promise<void> {
  // Booting again replaces the previous subscriptions (tests, hot reload).
  for (const stop of teardown) stop();
  teardown = [];
  await hydrateSettings(storage);
  teardown.push(persistSettings(storage), followTheme());
  if (devLevel !== null) {
    gameStore.getState().startLevel(LEVELS[devLevel]);
    return;
  }
  await hydrateProgress(storage);
  teardown.push(persistProgress(storage), recordWins());
  if (!(await restoreSaved(storage))) startCurrent();
  // After the restore, so restoring does not write itself back.
  teardown.push(installAutosave(storage));
}

/** Restores the saved game if it is for the level progress points at. */
async function restoreSaved(storage: Storage): Promise<boolean> {
  const level = currentLevel(progressStore.getState());
  let restored = null;
  try {
    restored = level && fromSaved(await storage.get("save"), level);
  } catch {
    // Unreadable: start fresh.
  }
  if (!restored) {
    await storage.remove("save").catch(() => {});
    return false;
  }
  gameStore.setState(restored);
  return true;
}

/** Dev-only `?level=<id>` start override as a campaign index, else null. */
export function devLevelOverride(
  search: string,
  isDev: boolean,
): number | null {
  if (!isDev) return null;
  const index = levelIndex(new URLSearchParams(search).get("level") ?? "");
  return index < 0 ? null : index;
}

/** Applies the theme setting now and on every change; the returned stop undoes both. */
function followTheme(): () => void {
  mirrorTheme(settingsStore.getState().theme);
  let stopApply = applyTheme(settingsStore.getState().theme);
  let current = settingsStore.getState().theme;
  const unsubscribe = settingsStore.subscribe(({ theme }) => {
    if (theme === current) return;
    current = theme;
    mirrorTheme(theme);
    stopApply();
    stopApply = applyTheme(theme);
  });
  return () => {
    unsubscribe();
    stopApply();
  };
}

/**
 * The saved theme lives in the platform store, which index.html cannot read before first
 * paint, so mirror it into localStorage (key read by the inline no-flash script).
 */
function mirrorTheme(theme: string): void {
  try {
    localStorage.setItem("doku:theme", theme);
  } catch {
    // Storage unavailable: worst case is a first-paint flash.
  }
}
