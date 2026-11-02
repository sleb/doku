import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { idleState } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { useClock } from "./useClock";

let now = 0;
const advance = (ms: number) => {
  now += ms;
  vi.advanceTimersByTime(ms);
};
const elapsed = () => {
  const s = gameStore.getState();
  return s.status === "idle" ? -1 : s.elapsedMs;
};

beforeEach(() => {
  now = 1000;
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  vi.spyOn(performance, "now").mockImplementation(() => now);
  gameStore.setState(idleState, false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useClock", () => {
  test("adds about one second after one second of play", () => {
    gameStore.getState().startLevel(level);
    renderHook(() => useClock());
    act(() => advance(1000));
    expect(elapsed()).toBe(1000);
  });

  test("a delayed interval loses no time", () => {
    gameStore.getState().startLevel(level);
    renderHook(() => useClock());
    act(() => {
      now += 1700;
      vi.advanceTimersByTime(500);
    });
    expect(elapsed()).toBe(1700);
  });

  test("does not tick while paused, won or lost, or idle", () => {
    renderHook(() => useClock());
    act(() => advance(2000));
    expect(elapsed()).toBe(-1);
    gameStore.getState().startLevel(level);
    for (const status of ["paused", "won", "lost"] as const) {
      gameStore.setState({ status }, false);
      act(() => advance(2000));
      expect(elapsed()).toBe(0);
    }
  });

  test("adds no time for the paused gap", () => {
    gameStore.getState().startLevel(level);
    renderHook(() => useClock());
    act(() => advance(1000));
    act(() => gameStore.getState().pause());
    act(() => advance(5000));
    act(() => gameStore.getState().resume());
    act(() => advance(500));
    expect(elapsed()).toBe(1500);
  });

  test("stops on unmount", () => {
    gameStore.getState().startLevel(level);
    const { unmount } = renderHook(() => useClock());
    unmount();
    act(() => advance(3000));
    expect(elapsed()).toBe(0);
  });
});
