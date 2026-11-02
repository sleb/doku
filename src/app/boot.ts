import type { Storage } from "../platform/storage";
import { hydrateSettings, persistSettings } from "../store/settings";

/** Loads saved state, then starts saving changes. Resolves before first paint. */
export async function boot(storage: Storage): Promise<void> {
  await hydrateSettings(storage);
  persistSettings(storage);
}
