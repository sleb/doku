import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { judgeTap } from "../../engine";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { idleState } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { useClock } from "./useClock";

let now = 0;
// Step in 100 ms so each interval tick sees the clock at its own time.
const advance = (ms: number) => {
  for (let t = 0; t < ms; t += 100) {
    now += 100;
    vi.advanceTimersByTime(100);
  }
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

  test("pausing mid-interval credits the time since the last tick", () => {
    gameStore.getState().startLevel(level);
    renderHook(() => useClock());
    act(() => advance(1200));
    act(() => gameStore.getState().pause());
    expect(elapsed()).toBe(1200);
    act(() => gameStore.getState().resume());
    act(() => advance(500));
    expect(elapsed()).toBe(1700);
  });

  test("the winning move carries the time since the last tick", () => {
    gameStore.getState().startLevel(level);
    renderHook(() => useClock());
    act(() => advance(1200));
    const wins: number[] = [];
    gameStore.subscribe((s) => {
      if (s.status === "won") wins.push(s.elapsedMs);
    });
    const cells = [...Array(level.size ** 2).keys()].filter(
      (c) => judgeTap(level, c) === "correct",
    );
    act(() => {
      for (const c of cells) gameStore.getState().placeFace(c);
    });
    expect(wins[0]).toBe(1200);
  });

  test("stops on unmount", () => {
    gameStore.getState().startLevel(level);
    const { unmount } = renderHook(() => useClock());
    unmount();
    act(() => advance(3000));
    expect(elapsed()).toBe(0);
  });
});
