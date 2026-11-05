import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryStorage } from "../platform/storage";
import {
  hydrateSettings,
  parseSettings,
  persistSettings,
  type Settings,
  settingsStore,
} from "./settings";

const defaults: Settings = {
  haptics: true,
  sound: true,
  theme: "system",
  palette: "default",
  patterns: false,
  inputMode: "mark",
  seenTutorial: false,
};

const base = { haptics: true, seenTutorial: false };

describe("parseSettings", () => {
  test("undefined gives defaults", () => {
    expect(parseSettings(undefined)).toEqual(defaults);
  });

  test("a valid object round-trips", () => {
    expect(parseSettings({ haptics: false, seenTutorial: true })).toEqual({
      ...defaults,
      haptics: false,
      seenTutorial: true,
    });
  });

  test("a partial object keeps what is valid and defaults the rest", () => {
    expect(parseSettings({ haptics: false })).toEqual({
      ...defaults,
      haptics: false,
      seenTutorial: false,
    });
  });

  test("a wrong-typed field falls back to its own default", () => {
    expect(parseSettings({ haptics: "no", seenTutorial: true })).toEqual({
      ...defaults,
      haptics: true,
      seenTutorial: true,
    });
  });

  test.each([null, 42, "x", true])("%j gives defaults", (raw) => {
    expect(parseSettings(raw)).toEqual(defaults);
  });

  test("an array gives defaults", () => {
    expect(parseSettings([true, true])).toEqual(defaults);
  });

  test("extra keys are dropped", () => {
    expect(
      parseSettings({ haptics: false, seenTutorial: true, theme: "x" }),
    ).toEqual({ ...defaults, haptics: false, seenTutorial: true });
  });

  test("never throws on arbitrary JSON-ish input", () => {
    const junk = [
      undefined,
      null,
      0,
      NaN,
      "",
      [],
      {},
      [[]],
      { haptics: {} },
      { seenTutorial: [1] },
      () => 1,
      Symbol("s"),
    ];
    for (const j of junk) {
      const out = parseSettings(j);
      expect(typeof out.haptics).toBe("boolean");
      expect(typeof out.seenTutorial).toBe("boolean");
    }
  });
});

describe("parseSettings (all fields)", () => {
  test("valid values are kept", () => {
    const v = {
      haptics: false,
      sound: false,
      theme: "dark",
      palette: "accessible",
      patterns: true,
      inputMode: "face",
      seenTutorial: true,
    };
    expect(parseSettings(v)).toEqual(v);
  });

  test("wrong types and unknown enums fall back", () => {
    expect(
      parseSettings({
        sound: 1,
        theme: "neon",
        palette: 3,
        patterns: "yes",
        inputMode: "x",
      }),
    ).toEqual(defaults);
  });

  test("the old seenRules key is ignored", () => {
    expect(parseSettings({ seenRules: true })).toEqual(defaults);
  });
});

describe("settingsStore", () => {
  test("starts with defaults", () => {
    const { haptics, seenTutorial } = settingsStore.getState();
    expect({ haptics, seenTutorial }).toEqual(base);
  });
});

describe("settingsStore.set", () => {
  test("merges a patch and leaves other fields alone", () => {
    settingsStore.getState().set({ haptics: false });
    const { haptics, seenTutorial } = settingsStore.getState();
    expect({ haptics, seenTutorial }).toEqual({
      haptics: false,
      seenTutorial: false,
    });
  });
});

describe("hydrateSettings", () => {
  beforeEach(() => settingsStore.setState(defaults));

  test("fills the store from stored settings", async () => {
    const storage = new MemoryStorage();
    await storage.set("settings", { haptics: false, seenTutorial: true });
    await hydrateSettings(storage);
    const { haptics, seenTutorial } = settingsStore.getState();
    expect({ haptics, seenTutorial }).toEqual({
      haptics: false,
      seenTutorial: true,
    });
  });

  test("leaves defaults when nothing is stored", async () => {
    await hydrateSettings(new MemoryStorage());
    const { haptics, seenTutorial } = settingsStore.getState();
    expect({ haptics, seenTutorial }).toEqual(base);
  });

  test("a rejecting read leaves defaults and does not throw", async () => {
    const storage = new MemoryStorage();
    storage.get = () => Promise.reject(new Error("boom"));
    await expect(hydrateSettings(storage)).resolves.toBeUndefined();
    const { haptics, seenTutorial } = settingsStore.getState();
    expect({ haptics, seenTutorial }).toEqual(base);
  });

  test.each(["garbage", { haptics: 5 }])(
    "corrupt %j gives defaults",
    async (bad) => {
      const storage = new MemoryStorage();
      await storage.set("settings", bad);
      await hydrateSettings(storage);
      const { haptics, seenTutorial } = settingsStore.getState();
      expect({ haptics, seenTutorial }).toEqual(base);
    },
  );
});

describe("persistSettings", () => {
  beforeEach(() => settingsStore.setState(defaults));

  test("writes the settings under `settings` on change", async () => {
    const storage = new MemoryStorage();
    persistSettings(storage);
    settingsStore.getState().set({ haptics: false });
    expect(await storage.get("settings")).toEqual({
      ...defaults,
      haptics: false,
      seenTutorial: false,
    });
  });

  test("a rejected write is swallowed", async () => {
    const storage = new MemoryStorage();
    storage.set = () => Promise.reject(new Error("disk full"));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    persistSettings(storage);
    settingsStore.getState().set({ haptics: false });
    await new Promise((r) => setTimeout(r, 10));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  test("unsubscribe stops writes", async () => {
    const storage = new MemoryStorage();
    const stop = persistSettings(storage);
    stop();
    settingsStore.getState().set({ haptics: false });
    expect(await storage.get("settings")).toBeUndefined();
  });

  test("persist, change, reset, hydrate round-trips", async () => {
    const storage = new MemoryStorage();
    const stop = persistSettings(storage);
    settingsStore.getState().set({ haptics: false, seenTutorial: true });
    await storage.flush();
    stop();
    settingsStore.setState(defaults);
    await hydrateSettings(storage);
    const { haptics, seenTutorial } = settingsStore.getState();
    expect({ haptics, seenTutorial }).toEqual({
      haptics: false,
      seenTutorial: true,
    });
  });
});
