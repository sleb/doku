import type { Storage } from "../platform/storage";
import { hydrateProgress, persistProgress } from "../store/progress";
import { hydrateSettings, persistSettings } from "../store/settings";
import { recordWins, startCurrent } from "./campaign";

/** Loads saved state, then starts saving changes. Resolves before first paint. */
export async function boot(storage: Storage): Promise<void> {
  await hydrateSettings(storage);
  persistSettings(storage);
  await hydrateProgress(storage);
  persistProgress(storage);
  recordWins();
  startCurrent();
}
