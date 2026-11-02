import { createStore } from "zustand/vanilla";

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
