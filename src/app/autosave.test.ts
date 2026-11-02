import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { MemoryStorage } from "../platform/storage";
import { idleState } from "../store/game";
import { gameStore } from "../store/gameStore";
import { installAutosave } from "./autosave";

let storage: MemoryStorage;
let stop: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  storage = new MemoryStorage();
  gameStore.setState(idleState);
  gameStore.getState().startLevel(uniqueLevel7);
  stop = installAutosave(storage);
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe("installAutosave", () => {
  test("writes a change after the debounce, not before", async () => {
    gameStore.getState().toggleMark(3);
    vi.advanceTimersByTime(249);
    expect(await storage.get("save")).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(await storage.get("save")).toMatchObject({
      levelId: uniqueLevel7.id,
    });
  });
});

describe("installAutosave coalescing", () => {
  test("rapid changes write once, the latest", async () => {
    const set = vi.spyOn(storage, "set");
    gameStore.getState().toggleMark(3);
    vi.advanceTimersByTime(100);
    gameStore.getState().toggleMark(4);
    vi.advanceTimersByTime(250);
    expect(set).toHaveBeenCalledTimes(1);
    const saved = await storage.get<{ board: number[] }>("save");
    expect(saved?.board[3]).toBe(1);
    expect(saved?.board[4]).toBe(1);
  });
});

describe("installAutosave ticks", () => {
  test("a clock tick writes nothing", async () => {
    gameStore.getState().tick(1000);
    vi.advanceTimersByTime(1000);
    expect(await storage.get("save")).toBeUndefined();
  });
});

describe("installAutosave moves", () => {
  test("a wrong tap saves the wrong cell and a lost heart", async () => {
    const wrongCell = uniqueLevel7.solution[0] === 0 ? 1 : 0;
    gameStore.getState().placeFace(wrongCell);
    vi.advanceTimersByTime(250);
    expect(await storage.get("save")).toMatchObject({
      wrong: [wrongCell],
      hearts: 2,
    });
  });

  test("a hint saves hintsUsed", async () => {
    gameStore.getState().hint();
    vi.advanceTimersByTime(250);
    expect(await storage.get("save")).toMatchObject({
      hintsUsed: 1,
      hearts: 2,
    });
  });
});

describe("installAutosave finish", () => {
  test.each(["won", "lost"] as const)("%s removes the save and cancels a pending write", async (status) => {
    gameStore.getState().toggleMark(3);
    vi.advanceTimersByTime(250);
    expect(await storage.get("save")).toBeDefined();
    gameStore.getState().toggleMark(4);
    gameStore.setState({ status });
    expect(await storage.get("save")).toBeUndefined();
    vi.advanceTimersByTime(1000);
    expect(await storage.get("save")).toBeUndefined();
  });
});
