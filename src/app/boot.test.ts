import { beforeEach, describe, expect, test } from "vitest";
import { MemoryStorage } from "../platform/storage";
import { defaultSettings, settingsStore } from "../store/settings";
import { boot } from "./boot";

beforeEach(() => settingsStore.setState(defaultSettings));

describe("boot", () => {
  test("hydrates the settings store from storage", async () => {
    const storage = new MemoryStorage();
    await storage.set("settings", { haptics: false, seenRules: true });
    await boot(storage);
    expect(settingsStore.getState().haptics).toBe(false);
    expect(settingsStore.getState().seenRules).toBe(true);
  });

  test("persists later changes", async () => {
    const storage = new MemoryStorage();
    await boot(storage);
    settingsStore.getState().set({ haptics: false });
    expect(await storage.get("settings")).toEqual({
      haptics: false,
      seenRules: false,
    });
  });

  test("corrupt stored settings boot to defaults", async () => {
    const storage = new MemoryStorage();
    await storage.set("settings", "garbage");
    await boot(storage);
    expect(settingsStore.getState().haptics).toBe(true);
    expect(settingsStore.getState().seenRules).toBe(false);
  });
});
