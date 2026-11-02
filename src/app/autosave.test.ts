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
