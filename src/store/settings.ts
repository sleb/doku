import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { Storage } from "../platform/storage";

export type Settings = {
  haptics: boolean;
  sound: boolean;
  theme: "system" | "light" | "dark";
  palette: "default" | "accessible";
  patterns: boolean;
  inputMode: "mark" | "face";
  seenTutorial: boolean;
};

export const defaultSettings: Settings = {
  haptics: true,
  sound: true,
  theme: "system",
  palette: "default",
  patterns: false,
  inputMode: "mark",
  seenTutorial: false,
};

const bool = (v: unknown, fallback: boolean) =>
  typeof v === "boolean" ? v : fallback;

const oneOf = <T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T => (allowed.includes(v as T) ? (v as T) : fallback);

export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== "object" || raw === null) return { ...defaultSettings };
  const r = raw as Record<string, unknown>;
  const d = defaultSettings;
  return {
    haptics: bool(r.haptics, d.haptics),
    sound: bool(r.sound, d.sound),
    theme: oneOf(r.theme, ["system", "light", "dark"], d.theme),
    palette: oneOf(r.palette, ["default", "accessible"], d.palette),
    patterns: bool(r.patterns, d.patterns),
    inputMode: oneOf(r.inputMode, ["mark", "face"], d.inputMode),
    seenTutorial: bool(r.seenTutorial, d.seenTutorial),
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

export function persistSettings(storage: Storage): () => void {
  return settingsStore.subscribe(({ set: _set, ...settings }) => {
    storage.set(KEY, settings).catch(() => {});
  });
}

export function useSettingsStore<T>(selector: (s: SettingsStore) => T): T {
  return useStore(settingsStore, selector);
}
