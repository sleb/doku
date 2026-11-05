import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { haptics } from "../../platform/haptics";
import { idleState } from "../../store/game";
import { createGameStore, gameStore } from "../../store/gameStore";
import { settingsStore } from "../../store/settings";
import { useFeedback } from "./useFeedback";

vi.mock("../../platform/haptics", () => ({
  haptics: { play: vi.fn().mockResolvedValue(undefined) },
}));

const n = level.size;
const solution = level.solution.map((c, r) => r * n + c);
const wrongCell = Array.from({ length: n * n }, (_, i) => i).find(
  (i) => !solution.includes(i),
) as number;
const play = () => vi.mocked(haptics.play);

beforeEach(() => {
  play().mockClear();
  settingsStore.getState().set({ haptics: true });
  gameStore.setState(idleState, false);
  gameStore.getState().startLevel(level);
});

describe("useFeedback", () => {
  test("plays place for a correct face on the default store", () => {
    renderHook(() => useFeedback());
    act(() => gameStore.getState().placeFace(solution[0]));
    expect(play()).toHaveBeenCalledWith("place");
  });

  test("plays wrong for a wrong face", () => {
    renderHook(() => useFeedback());
    act(() => gameStore.getState().placeFace(wrongCell));
    expect(play()).toHaveBeenCalledWith("wrong");
  });

  test("reads the haptics setting at event time", () => {
    renderHook(() => useFeedback());
    settingsStore.getState().set({ haptics: false });
    act(() => gameStore.getState().placeFace(solution[0]));
    expect(play()).not.toHaveBeenCalled();
    settingsStore.getState().set({ haptics: true });
    act(() => gameStore.getState().placeFace(solution[1]));
    expect(play()).toHaveBeenCalledTimes(1);
  });

  test("restart and startLevel are silent", () => {
    renderHook(() => useFeedback());
    act(() => {
      gameStore.getState().placeFace(solution[0]);
    });
    play().mockClear();
    act(() => {
      gameStore.getState().restart();
      gameStore.getState().startLevel(level);
    });
    expect(play()).not.toHaveBeenCalled();
  });

  test("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useFeedback());
    unmount();
    act(() => gameStore.getState().placeFace(solution[0]));
    expect(play()).not.toHaveBeenCalled();
  });

  test("listens to a custom store only", () => {
    const other = createGameStore();
    other.getState().startLevel(level);
    renderHook(() => useFeedback(other));
    act(() => gameStore.getState().placeFace(solution[0]));
    expect(play()).not.toHaveBeenCalled();
    act(() => other.getState().placeFace(solution[0]));
    expect(play()).toHaveBeenCalledWith("place");
  });
});
