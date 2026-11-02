import { LEVELS, levelIndex } from "../levels/campaign";
import type { Storage } from "../platform/storage";
import { gameStore } from "../store/gameStore";
import { hydrateProgress, persistProgress } from "../store/progress";
import { hydrateSettings, persistSettings } from "../store/settings";
import { recordWins, startCurrent } from "./campaign";

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
  teardown.push(persistSettings(storage));
  if (devLevel !== null) {
    gameStore.getState().startLevel(LEVELS[devLevel]);
    return;
  }
  await hydrateProgress(storage);
  teardown.push(persistProgress(storage), recordWins());
  startCurrent();
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
