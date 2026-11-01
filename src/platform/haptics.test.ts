import { describe, expect, it, vi } from "vitest";
import { createHaptics, haptics } from "./haptics";

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
    expect(plugin.impactFeedback).toHaveBeenCalledWith("light");
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
