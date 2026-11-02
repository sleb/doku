import { beforeEach, describe, expect, test } from "vitest";
import { MemoryStorage } from "../platform/storage";
import { hydrateSettings, parseSettings, settingsStore } from "./settings";

const defaults = { haptics: true, seenRules: false };

describe("parseSettings", () => {
  test("undefined gives defaults", () => {
    expect(parseSettings(undefined)).toEqual(defaults);
  });

  test("a valid object round-trips", () => {
    expect(parseSettings({ haptics: false, seenRules: true })).toEqual({
      haptics: false,
      seenRules: true,
    });
  });

  test("a partial object keeps what is valid and defaults the rest", () => {
    expect(parseSettings({ haptics: false })).toEqual({
      haptics: false,
      seenRules: false,
    });
  });

  test("a wrong-typed field falls back to its own default", () => {
    expect(parseSettings({ haptics: "no", seenRules: true })).toEqual({
      haptics: true,
      seenRules: true,
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
      parseSettings({ haptics: false, seenRules: true, theme: "x" }),
    ).toEqual({ haptics: false, seenRules: true });
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
      { seenRules: [1] },
      () => 1,
      Symbol("s"),
    ];
    for (const j of junk) {
      const out = parseSettings(j);
      expect(typeof out.haptics).toBe("boolean");
      expect(typeof out.seenRules).toBe("boolean");
    }
  });
});

describe("settingsStore", () => {
  test("starts with defaults", () => {
    const { haptics, seenRules } = settingsStore.getState();
    expect({ haptics, seenRules }).toEqual(defaults);
  });
});

describe("settingsStore.set", () => {
  test("merges a patch and leaves other fields alone", () => {
    settingsStore.getState().set({ haptics: false });
    const { haptics, seenRules } = settingsStore.getState();
    expect({ haptics, seenRules }).toEqual({
      haptics: false,
      seenRules: false,
    });
  });
});

describe("hydrateSettings", () => {
  beforeEach(() => settingsStore.setState(defaults));

  test("fills the store from stored settings", async () => {
    const storage = new MemoryStorage();
    await storage.set("settings", { haptics: false, seenRules: true });
    await hydrateSettings(storage);
    const { haptics, seenRules } = settingsStore.getState();
    expect({ haptics, seenRules }).toEqual({ haptics: false, seenRules: true });
  });

  test("leaves defaults when nothing is stored", async () => {
    await hydrateSettings(new MemoryStorage());
    const { haptics, seenRules } = settingsStore.getState();
    expect({ haptics, seenRules }).toEqual(defaults);
  });

  test("a rejecting read leaves defaults and does not throw", async () => {
    const storage = new MemoryStorage();
    storage.get = () => Promise.reject(new Error("boom"));
    await expect(hydrateSettings(storage)).resolves.toBeUndefined();
    const { haptics, seenRules } = settingsStore.getState();
    expect({ haptics, seenRules }).toEqual(defaults);
  });

  test.each(["garbage", { haptics: 5 }])("corrupt %j gives defaults", async (bad) => {
    const storage = new MemoryStorage();
    await storage.set("settings", bad);
    await hydrateSettings(storage);
    const { haptics, seenRules } = settingsStore.getState();
    expect({ haptics, seenRules }).toEqual(defaults);
  });
});
