import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LEVELS } from "../levels/campaign";
import { MemoryStorage } from "../platform/storage";
import { idleState, type Started, startLevel, toggleMark } from "../store/game";
import { gameStore } from "../store/gameStore";
import { toSaved } from "../store/persist";
import { defaultProgress, progressStore } from "../store/progress";
import { defaultSettings, settingsStore } from "../store/settings";
import { boot, devLevelOverride } from "./boot";

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
    gameStore.setState({ status: "won", elapsedMs: 9000 });
    const saved = await storage.get("progress");
    gameStore.setState(idleState);
    progressStore.setState(defaultProgress);
    const relaunch = new MemoryStorage();
    await relaunch.set("progress", saved);
    await boot(relaunch);
    expect(gameStore.getState().level).toBe(LEVELS[1]);
  });
});

describe("devLevelOverride", () => {
  test("maps a known level id to its index in dev", () => {
    expect(devLevelOverride(`?level=${LEVELS[2].id}`, true)).toBe(2);
  });

  test("is null outside dev", () => {
    expect(devLevelOverride(`?level=${LEVELS[2].id}`, false)).toBeNull();
  });

  test("unknown or missing id is null", () => {
    expect(devLevelOverride("?level=nope", true)).toBeNull();
    expect(devLevelOverride("", true)).toBeNull();
  });
});

describe("boot dev override", () => {
  test("starts the overridden level, ignoring stored progress", async () => {
    const storage = new MemoryStorage();
    await storage.set("progress", { next: 1, bestMs: {} });
    await boot(storage, { devLevel: 3 });
    expect(gameStore.getState().level).toBe(LEVELS[3]);
  });

  test("a win under the override writes no progress", async () => {
    const storage = new MemoryStorage();
    await boot(storage, { devLevel: 3 });
    gameStore.setState({ status: "won", elapsedMs: 1 });
    expect(await storage.get("progress")).toBeUndefined();
    expect(progressStore.getState().next).toBe(0);
  });

  test("an unreadable store starts level 1", async () => {
    const storage = new MemoryStorage();
    storage.get = () => Promise.reject(new Error("boom"));
    await boot(storage);
    expect(gameStore.getState().level).toBe(LEVELS[0]);
  });
});

describe("boot save", () => {
  test("a valid save restores a paused game", async () => {
    const storage = new MemoryStorage();
    const first = LEVELS[0];
    const played = startLevel(first) as Started;
    await storage.set("save", toSaved(toggleMark(played, 4) as Started));
    await boot(storage);
    const state = gameStore.getState();
    expect(state.status).toBe("paused");
    expect(state.level).toBe(first);
    expect(state.board?.[4]).toBe(1);
  });
});

describe("boot stale save", () => {
  test("a save for another level is removed and a fresh level starts", async () => {
    const storage = new MemoryStorage();
    const other = startLevel(LEVELS[1]) as Started;
    await storage.set("save", toSaved(toggleMark(other, 4) as Started));
    await boot(storage);
    expect(gameStore.getState().status).toBe("playing");
    expect(gameStore.getState().level).toBe(LEVELS[0]);
    expect(await storage.get("save")).toBeUndefined();
  });
});

describe("boot corrupt save", () => {
  test("a corrupt save starts fresh, is removed and does not throw", async () => {
    const storage = new MemoryStorage();
    await storage.set("save", { levelId: LEVELS[0].id, board: "junk" });
    await expect(boot(storage)).resolves.toBeUndefined();
    expect(gameStore.getState().status).toBe("playing");
    expect(await storage.get("save")).toBeUndefined();
  });

  test("no save starts the level normally", async () => {
    await boot(new MemoryStorage());
    expect(gameStore.getState().status).toBe("playing");
  });
});

describe("boot autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("a move after boot is autosaved", async () => {
    const storage = new MemoryStorage();
    await boot(storage);
    gameStore.getState().toggleMark(4);
    vi.advanceTimersByTime(250);
    expect(await storage.get("save")).toMatchObject({ levelId: LEVELS[0].id });
  });

  test("restoring does not write itself back or record a win", async () => {
    const storage = new MemoryStorage();
    const played = startLevel(LEVELS[0]) as Started;
    const save = toSaved(toggleMark(played, 4) as Started);
    await storage.set("save", save);
    const set = vi.spyOn(storage, "set");
    await boot(storage);
    vi.advanceTimersByTime(1000);
    expect(set).not.toHaveBeenCalledWith("save", expect.anything());
    expect(progressStore.getState().next).toBe(0);
  });

  test("a win removes the save while recording progress", async () => {
    const storage = new MemoryStorage();
    await boot(storage);
    gameStore.getState().toggleMark(4);
    vi.advanceTimersByTime(250);
    gameStore.setState({ status: "won", elapsedMs: 9000 });
    expect(await storage.get("save")).toBeUndefined();
    expect(progressStore.getState().next).toBe(1);
    expect(await storage.get("progress")).toMatchObject({ next: 1 });
  });

  test("the dev override ignores a valid save and installs no autosave", async () => {
    const storage = new MemoryStorage();
    const played = startLevel(LEVELS[0]) as Started;
    const save = toSaved(toggleMark(played, 4) as Started);
    await storage.set("save", save);
    await boot(storage, { devLevel: 3 });
    expect(gameStore.getState().status).toBe("playing");
    gameStore.getState().toggleMark(5);
    vi.advanceTimersByTime(1000);
    expect(await storage.get("save")).toEqual(save);
  });

  test("booting again tears down the previous autosave", async () => {
    const storage = new MemoryStorage();
    await boot(storage);
    const set = vi.spyOn(storage, "set");
    await boot(new MemoryStorage());
    gameStore.getState().toggleMark(4);
    vi.advanceTimersByTime(1000);
    expect(set).not.toHaveBeenCalledWith("save", expect.anything());
  });
});
