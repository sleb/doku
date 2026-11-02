import { beforeEach, describe, expect, test } from "vitest";
import { LEVELS } from "../levels/campaign";
import { MemoryStorage } from "../platform/storage";
import { idleState } from "../store/game";
import { gameStore } from "../store/gameStore";
import { defaultProgress, progressStore } from "../store/progress";
import { defaultSettings, settingsStore } from "../store/settings";
import { boot } from "./boot";

beforeEach(() => {
  settingsStore.setState(defaultSettings);
  progressStore.setState(defaultProgress);
  gameStore.setState(idleState);
});

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

describe("boot progress", () => {
  test("starts the level stored progress points at", async () => {
    const storage = new MemoryStorage();
    await storage.set("progress", { next: 2, bestMs: {} });
    await boot(storage);
    expect(gameStore.getState().level).toBe(LEVELS[2]);
  });

  test("empty storage starts level 1", async () => {
    await boot(new MemoryStorage());
    expect(gameStore.getState().level).toBe(LEVELS[0]);
  });

  test("a finished campaign boots idle", async () => {
    const storage = new MemoryStorage();
    await storage.set("progress", { next: LEVELS.length, bestMs: {} });
    await boot(storage);
    expect(gameStore.getState().status).toBe("idle");
  });

  test("a win persists progress so a second boot starts the next level", async () => {
    const storage = new MemoryStorage();
    await boot(storage);
    gameStore.setState({ ...gameStore.getState(), status: "won", elapsedMs: 9000 });
    const saved = await storage.get("progress");
    gameStore.setState(idleState);
    progressStore.setState(defaultProgress);
    const relaunch = new MemoryStorage();
    await relaunch.set("progress", saved);
    await boot(relaunch);
    expect(gameStore.getState().level).toBe(LEVELS[1]);
  });
});
