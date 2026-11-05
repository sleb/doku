import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHaptics, defaultLog, detectMobile, haptics } from "./haptics";
import { HOLD_RAMP } from "./holdRamp";

function setup(
  over: {
    isTauri?: boolean;
    isMobile?: boolean;
    load?: () => Promise<unknown>;
  } = {},
) {
  const plugin = {
    impactFeedback: vi.fn().mockResolvedValue(undefined),
    notificationFeedback: vi.fn().mockResolvedValue(undefined),
  };
  const load = vi.fn(over.load ?? (async () => plugin));
  const h = createHaptics({
    isTauri: () => over.isTauri ?? true,
    isMobile: () => over.isMobile ?? true,
    log: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: test fake
    loadPlugin: load as any,
  });
  return { plugin, load, h };
}

describe("supported", () => {
  it.each([
    [true, true, true],
    [true, false, false],
    [false, true, false],
  ])("tauri %s, mobile %s gives %s", (isTauri, isMobile, expected) => {
    expect(setup({ isTauri, isMobile }).h.supported()).toBe(expected);
  });
});

describe("createHaptics", () => {
  it("never touches the plugin outside Tauri", async () => {
    const { plugin, load, h } = setup({ isTauri: false });
    for (const k of ["place", "wrong", "win", "lose"] as const) {
      await h.play(k);
    }
    expect(load).not.toHaveBeenCalled();
    expect(plugin.impactFeedback).not.toHaveBeenCalled();
    expect(plugin.notificationFeedback).not.toHaveBeenCalled();
  });

  it("never touches the plugin on desktop Tauri", async () => {
    const { plugin, load, h } = setup({ isMobile: false });
    for (const k of ["place", "wrong", "win", "lose"] as const) {
      await h.play(k);
    }
    expect(load).not.toHaveBeenCalled();
    expect(plugin.impactFeedback).not.toHaveBeenCalled();
    expect(plugin.notificationFeedback).not.toHaveBeenCalled();
  });

  it("maps each kind to the plugin call", async () => {
    const { plugin, h } = setup();
    await h.play("place");
    expect(plugin.impactFeedback).toHaveBeenCalledWith("heavy");
    await h.play("wrong");
    expect(plugin.notificationFeedback).toHaveBeenLastCalledWith("warning");
    await h.play("win");
    expect(plugin.notificationFeedback).toHaveBeenLastCalledWith("success");
    await h.play("lose");
    expect(plugin.notificationFeedback).toHaveBeenLastCalledWith("error");
  });

  it("resolves when the plugin rejects, throws, or fails to load", async () => {
    const rejecting = setup();
    rejecting.plugin.impactFeedback.mockRejectedValue(new Error("no plugin"));
    await expect(rejecting.h.play("place")).resolves.toBeUndefined();

    const throwing = setup();
    throwing.plugin.notificationFeedback.mockImplementation(() => {
      throw new Error("boom");
    });
    await expect(throwing.h.play("win")).resolves.toBeUndefined();

    const failing = setup({
      load: async () => {
        throw new Error("load");
      },
    });
    await expect(failing.h.play("lose")).resolves.toBeUndefined();
  });

  it("loads the plugin once across plays", async () => {
    const { load, h } = setup();
    await h.play("place");
    await h.play("win");
    await Promise.all([h.play("wrong"), h.play("lose")]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("retries loading after a failed load, still never rejecting", async () => {
    const plugin = {
      impactFeedback: vi.fn().mockResolvedValue(undefined),
      notificationFeedback: vi.fn().mockResolvedValue(undefined),
    };
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("load"))
      .mockResolvedValue(plugin);
    const h = createHaptics({
      isTauri: () => true,
      isMobile: () => true,
      // biome-ignore lint/suspicious/noExplicitAny: test fake
      loadPlugin: load as any,
      log: vi.fn(),
    });
    await expect(h.play("place")).resolves.toBeUndefined();
    expect(plugin.impactFeedback).not.toHaveBeenCalled();
    await expect(h.play("place")).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledTimes(2);
    expect(plugin.impactFeedback).toHaveBeenCalledTimes(1);
  });

  it("logs thrown and Result errors through the injected logger", async () => {
    const log = vi.fn();
    const plugin = {
      impactFeedback: vi
        .fn()
        .mockResolvedValue({ status: "error", error: "nope" }),
      notificationFeedback: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const h = createHaptics({
      isTauri: () => true,
      isMobile: () => true,
      // biome-ignore lint/suspicious/noExplicitAny: test fake
      loadPlugin: (async () => plugin) as any,
      log,
    });
    await expect(h.play("place")).resolves.toBeUndefined();
    await expect(h.play("win")).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("default singleton is a safe no-op in node", async () => {
    await expect(haptics.play("place")).resolves.toBeUndefined();
  });
});

describe("ramp", () => {
  const flush = async () => {
    await vi.advanceTimersByTimeAsync(0);
  };
  const calls = (p: { impactFeedback: ReturnType<typeof vi.fn> }) =>
    p.impactFeedback.mock.calls.map((c) => c[0]);

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires each pulse at its offset", async () => {
    const { plugin, h } = setup();
    h.ramp();
    await flush();
    expect(calls(plugin)).toEqual(["soft"]);
    let prev = 0;
    for (let i = 1; i < HOLD_RAMP.length; i++) {
      await vi.advanceTimersByTimeAsync(HOLD_RAMP[i].at - prev - 1);
      expect(plugin.impactFeedback).toHaveBeenCalledTimes(i);
      await vi.advanceTimersByTimeAsync(1);
      expect(plugin.impactFeedback).toHaveBeenCalledTimes(i + 1);
      expect(calls(plugin)[i]).toBe(HOLD_RAMP[i].style);
      prev = HOLD_RAMP[i].at;
    }
    await vi.advanceTimersByTimeAsync(2000);
    expect(plugin.impactFeedback).toHaveBeenCalledTimes(HOLD_RAMP.length);
  });

  it("is a no-op off-device", async () => {
    for (const over of [{ isTauri: false }, { isMobile: false }]) {
      const { plugin, load, h } = setup(over);
      const cancel = h.ramp();
      await vi.advanceTimersByTimeAsync(2000);
      cancel();
      expect(load).not.toHaveBeenCalled();
      expect(plugin.impactFeedback).not.toHaveBeenCalled();
    }
  });

  it("cancel stops the remaining pulses and is idempotent", async () => {
    const { plugin, h } = setup();
    const cancel = h.ramp();
    await vi.advanceTimersByTimeAsync(HOLD_RAMP[2].at);
    const n = plugin.impactFeedback.mock.calls.length;
    cancel();
    cancel();
    await vi.advanceTimersByTimeAsync(2000);
    expect(plugin.impactFeedback).toHaveBeenCalledTimes(n);
  });

  it("a second ramp cancels the first", async () => {
    const { plugin, h } = setup();
    h.ramp();
    await vi.advanceTimersByTimeAsync(HOLD_RAMP[1].at);
    h.ramp();
    await vi.advanceTimersByTimeAsync(2000);
    // first ramp got 2 pulses, second ramp all of them
    expect(plugin.impactFeedback).toHaveBeenCalledTimes(2 + HOLD_RAMP.length);
  });

  it("an old cancel does not stop a newer ramp", async () => {
    const { plugin, h } = setup();
    const old = h.ramp();
    h.ramp();
    old();
    await vi.advanceTimersByTimeAsync(2000);
    expect(plugin.impactFeedback).toHaveBeenCalledTimes(HOLD_RAMP.length);
  });

  it("swallows and logs plugin errors without stopping later pulses", async () => {
    const log = vi.fn();
    const plugin = {
      impactFeedback: vi
        .fn()
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValue({ status: "error", error: "nope" }),
      notificationFeedback: vi.fn(),
    };
    const h = createHaptics({
      isTauri: () => true,
      isMobile: () => true,
      // biome-ignore lint/suspicious/noExplicitAny: test fake
      loadPlugin: (async () => plugin) as any,
      log,
    });
    h.ramp();
    await vi.advanceTimersByTimeAsync(2000);
    expect(plugin.impactFeedback).toHaveBeenCalledTimes(HOLD_RAMP.length);
    expect(log).toHaveBeenCalledTimes(HOLD_RAMP.length);
  });
});

describe("detectMobile", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36";
  const MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  const WINDOWS =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
  const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36";

  it.each([
    ["iPhone", IPHONE, 5, true],
    ["Android", ANDROID, 5, true],
    ["iPadOS posing as a Mac", MAC, 5, true],
    ["touchscreen Windows", WINDOWS, 10, false],
    ["touchscreen Linux", LINUX, 10, false],
    ["plain desktop Mac", MAC, 0, false],
  ])("%s", (_name, ua, touch, expected) => {
    expect(detectMobile(ua, touch)).toBe(expected);
  });
});

describe("defaultLog", () => {
  it("warns on mobile and stays at debug elsewhere", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    defaultLog("boom", true);
    expect(warn).toHaveBeenCalledWith("haptics:", "boom");
    expect(debug).not.toHaveBeenCalled();
    defaultLog("quiet", false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith("haptics:", "quiet");
    warn.mockRestore();
    debug.mockRestore();
  });
});
