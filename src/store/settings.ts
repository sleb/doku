import { createStore } from "zustand/vanilla";
import type { Storage } from "../platform/storage";

export type Settings = { haptics: boolean; seenRules: boolean };

export const defaultSettings: Settings = { haptics: true, seenRules: false };

const bool = (v: unknown, fallback: boolean) =>
  typeof v === "boolean" ? v : fallback;

export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return { ...defaultSettings };
  const r = raw as Record<string, unknown>;
  return {
    haptics: bool(r.haptics, defaultSettings.haptics),
    seenRules: bool(r.seenRules, defaultSettings.seenRules),
  };
}

export type SettingsStore = Settings & {
  set(patch: Partial<Settings>): void;
};

export const settingsStore = createStore<SettingsStore>()((set) => ({
  ...defaultSettings,
  set: (patch) => set(patch),
}));

const KEY = "settings";

export async function hydrateSettings(storage: Storage): Promise<void> {
  try {
    settingsStore.getState().set(parseSettings(await storage.get(KEY)));
  } catch {
    // Unreadable: keep the defaults.
  }
}
