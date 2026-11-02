import { beforeEach, describe, expect, test, vi } from "vitest";
import { LEVELS } from "../levels/campaign";
import { MemoryStorage } from "../platform/storage";
import {
  currentLevel,
  defaultProgress,
  hydrateProgress,
  parseProgress,
  persistProgress,
  progressStore,
  recordWin,
  startOver,
} from "./progress";

describe("recordWin", () => {
  test("advances next past the level and records its best", () => {
    const p = recordWin(defaultProgress, 0, 5000);
    expect(p).toEqual({ next: 1, bestMs: { [LEVELS[0].id]: 5000 } });
  });
});

describe("recordWin replay", () => {
  test("replaying an earlier level never lowers next", () => {
    const p = recordWin(recordWin(defaultProgress, 0, 5000), 1, 6000);
    expect(recordWin(p, 0, 4000).next).toBe(2);
  });
});

describe("recordWin best", () => {
  test("a slower replay keeps the lower best", () => {
    const p = recordWin(defaultProgress, 0, 4000);
    expect(recordWin(p, 0, 9000).bestMs[LEVELS[0].id]).toBe(4000);
  });
});

describe("recordWin last level", () => {
  test("winning the last level sets next to the level count", () => {
    const p = recordWin(defaultProgress, LEVELS.length - 1, 1000);
    expect(p.next).toBe(LEVELS.length);
  });
});

describe("recordWin purity", () => {
  test("does not mutate its input", () => {
    const p = Object.freeze({
      next: 0,
      bestMs: Object.freeze({}) as Record<string, number>,
    });
    expect(() => recordWin(p, 0, 1)).not.toThrow();
    expect(p.next).toBe(0);
  });
});

describe("startOver", () => {
  test("resets next but keeps best times", () => {
    const p = recordWin(defaultProgress, 0, 4000);
    expect(startOver(p)).toEqual({ next: 0, bestMs: { [LEVELS[0].id]: 4000 } });
  });
});

describe("currentLevel", () => {
  test("is the level at next", () => {
    expect(currentLevel({ next: 2, bestMs: {} })).toBe(LEVELS[2]);
  });

  test("is null once the campaign is finished", () => {
    expect(currentLevel({ next: LEVELS.length, bestMs: {} })).toBeNull();
  });
});

describe("parseProgress", () => {
  test.each([undefined, null, 42, "x", [1]])("%j gives defaults", (raw) => {
    expect(parseProgress(raw, 8)).toEqual({ next: 0, bestMs: {} });
  });
});

describe("parseProgress valid", () => {
  test("a valid object round-trips", () => {
    const raw = { next: 3, bestMs: { a: 1000, b: 2500 } };
    expect(parseProgress(raw, 8)).toEqual(raw);
  });
});

describe("parseProgress next", () => {
  test("clamps a too-high next to the count", () => {
    expect(parseProgress({ next: 99, bestMs: {} }, 8).next).toBe(8);
  });
});

describe("parseProgress next low or fractional", () => {
  test.each([
    [-3, 0],
    [2.7, 2],
    ["3", 0],
    [Number.NaN, 0],
    [undefined, 0],
  ])("next %j becomes %j", (next, expected) => {
    expect(parseProgress({ next, bestMs: {} }, 8).next).toBe(expected);
  });
});

describe("parseProgress bestMs", () => {
  test("drops non-finite, negative and non-number times and non-object bestMs", () => {
    const bestMs = {
      ok: 1500,
      neg: -1,
      nan: null,
      str: "9",
      inf: Number.POSITIVE_INFINITY,
    };
    expect(parseProgress({ next: 1, bestMs }, 8).bestMs).toEqual({ ok: 1500 });
    expect(parseProgress({ next: 1, bestMs: [5] }, 8).bestMs).toEqual({});
    expect(parseProgress({ next: 1, bestMs: 7 }, 8).bestMs).toEqual({});
  });
});

describe("progressStore", () => {
  beforeEach(() => progressStore.setState(defaultProgress));

  test("record applies recordWin", () => {
    progressStore.getState().record(1, 3000);
    const { next, bestMs } = progressStore.getState();
    expect({ next, bestMs }).toEqual({
      next: 2,
      bestMs: { [LEVELS[1].id]: 3000 },
    });
  });

  test("startOver resets next and keeps bests", () => {
    progressStore.getState().record(1, 3000);
    progressStore.getState().startOver();
    const { next, bestMs } = progressStore.getState();
    expect({ next, bestMs }).toEqual({
      next: 0,
      bestMs: { [LEVELS[1].id]: 3000 },
    });
  });
});

describe("hydrateProgress", () => {
  beforeEach(() => progressStore.setState(defaultProgress));

  test("fills the store from stored progress", async () => {
    const storage = new MemoryStorage();
    await storage.set("progress", { next: 2, bestMs: { a: 900 } });
    await hydrateProgress(storage);
    const { next, bestMs } = progressStore.getState();
    expect({ next, bestMs }).toEqual({ next: 2, bestMs: { a: 900 } });
  });

  test("leaves defaults when nothing is stored", async () => {
    await hydrateProgress(new MemoryStorage());
    const { next, bestMs } = progressStore.getState();
    expect({ next, bestMs }).toEqual(defaultProgress);
  });

  test("a rejecting read leaves defaults and does not throw", async () => {
    const storage = new MemoryStorage();
    storage.get = () => Promise.reject(new Error("boom"));
    await expect(hydrateProgress(storage)).resolves.toBeUndefined();
    expect(progressStore.getState().next).toBe(0);
  });

  test("corrupt stored progress gives defaults", async () => {
    const storage = new MemoryStorage();
    await storage.set("progress", "garbage");
    await hydrateProgress(storage);
    const { next, bestMs } = progressStore.getState();
    expect({ next, bestMs }).toEqual(defaultProgress);
  });
});

describe("persistProgress", () => {
  beforeEach(() => progressStore.setState(defaultProgress));

  test("writes progress under `progress` on change", async () => {
    const storage = new MemoryStorage();
    persistProgress(storage);
    progressStore.getState().record(0, 4000);
    expect(await storage.get("progress")).toEqual({
      next: 1,
      bestMs: { [LEVELS[0].id]: 4000 },
    });
  });

  test("hydrating before persisting writes nothing", async () => {
    const storage = new MemoryStorage();
    await storage.set("progress", { next: 2, bestMs: {} });
    await hydrateProgress(storage);
    const set = vi.spyOn(storage, "set");
    persistProgress(storage);
    expect(set).not.toHaveBeenCalled();
  });

  test("unsubscribe stops writes", async () => {
    const storage = new MemoryStorage();
    persistProgress(storage)();
    progressStore.getState().record(0, 4000);
    expect(await storage.get("progress")).toBeUndefined();
  });
});
