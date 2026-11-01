import { describe, expect, it, vi } from "vitest";
import { createHaptics, haptics } from "./haptics";

function setup(
  over: { isTauri?: boolean; load?: () => Promise<unknown> } = {},
) {
  const plugin = {
    impactFeedback: vi.fn().mockResolvedValue(undefined),
    notificationFeedback: vi.fn().mockResolvedValue(undefined),
  };
  const load = vi.fn(over.load ?? (async () => plugin));
  const h = createHaptics({
    isTauri: () => over.isTauri ?? true,
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

  it("default singleton is a safe no-op in node", async () => {
    await expect(haptics.play("place")).resolves.toBeUndefined();
  });
});
