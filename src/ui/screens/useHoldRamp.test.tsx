import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { haptics } from "../../platform/haptics";
import { idleState } from "../../store/game";
import { createGameStore, gameStore } from "../../store/gameStore";
import { settingsStore } from "../../store/settings";
import { useHoldRamp } from "./useHoldRamp";

const cancels: ReturnType<typeof vi.fn>[] = [];
vi.mock("../../platform/haptics", () => ({
  haptics: {
    ramp: vi.fn(() => {
      const c = vi.fn();
      cancels.push(c);
      return c;
    }),
  },
}));

beforeEach(() => {
  cancels.length = 0;
  vi.mocked(haptics.ramp).mockClear();
  settingsStore.getState().set({ haptics: true });
  gameStore.setState(idleState, false);
  gameStore.getState().startLevel(level);
});

describe("useHoldRamp", () => {
  test("starts the ramp when a glow starts and cancels when it ends", () => {
    const { result } = renderHook(() => useHoldRamp());
    act(() => result.current(3));
    expect(haptics.ramp).toHaveBeenCalledTimes(1);
    expect(cancels[0]).not.toHaveBeenCalled();
    act(() => result.current(null));
    expect(cancels[0]).toHaveBeenCalledTimes(1);
  });

  test("never ramps with haptics off, read at event time", () => {
    const { result } = renderHook(() => useHoldRamp());
    settingsStore.getState().set({ haptics: false });
    act(() => result.current(3));
    expect(haptics.ramp).not.toHaveBeenCalled();
    settingsStore.getState().set({ haptics: true });
    act(() => result.current(3));
    expect(haptics.ramp).toHaveBeenCalledTimes(1);
  });

  test("a null glow without a ramp is harmless", () => {
    const { result } = renderHook(() => useHoldRamp());
    expect(() => act(() => result.current(null))).not.toThrow();
  });

  test("cancels when the game pauses", () => {
    const { result } = renderHook(() => useHoldRamp());
    act(() => result.current(3));
    act(() => gameStore.getState().pause());
    expect(cancels[0]).toHaveBeenCalled();
  });

  test("cancels on unmount", () => {
    const { result, unmount } = renderHook(() => useHoldRamp());
    act(() => result.current(3));
    unmount();
    expect(cancels[0]).toHaveBeenCalled();
  });

  test("a new glow cancels the previous ramp", () => {
    const { result } = renderHook(() => useHoldRamp());
    act(() => result.current(3));
    act(() => result.current(4));
    expect(cancels[0]).toHaveBeenCalled();
    expect(haptics.ramp).toHaveBeenCalledTimes(2);
  });
});

describe("useHoldRamp on a private store", () => {
  test("cancels when that store leaves playing, not the singleton", () => {
    const store = createGameStore();
    store.getState().startLevel(level);
    const { result } = renderHook(() => useHoldRamp(store));
    act(() => result.current(3));
    act(() => gameStore.getState().pause());
    expect(cancels[0]).not.toHaveBeenCalled();
    act(() => store.getState().pause());
    expect(cancels[0]).toHaveBeenCalledTimes(1);
  });
});
