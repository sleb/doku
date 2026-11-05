import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { haptics } from "../../platform/haptics";
import { sound } from "../../platform/sound";
import { idleState } from "../../store/game";
import { createGameStore, gameStore } from "../../store/gameStore";
import { settingsStore } from "../../store/settings";
import { fxStore } from "../fx/fxStore";
import { FX_MS, useFeedback } from "./useFeedback";

vi.mock("../../platform/haptics", () => ({
  haptics: { play: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../platform/sound", () => ({
  sound: {
    play: vi.fn().mockResolvedValue(undefined),
    unlock: vi.fn().mockResolvedValue(false),
    suspend: vi.fn(),
    resume: vi.fn(),
  },
}));

const n = level.size;
const solution = level.solution.map((c, r) => r * n + c);
const wrongCell = Array.from({ length: n * n }, (_, i) => i).find(
  (i) => !solution.includes(i),
) as number;
const play = () => vi.mocked(haptics.play);

beforeEach(() => {
  fxStore.setState({ last: null, seq: 0 }, false);
  play().mockClear();
  for (const f of Object.values(sound)) vi.mocked(f).mockClear();
  vi.mocked(sound.unlock).mockResolvedValue(false);
  settingsStore.getState().set({ haptics: true, sound: true });
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

describe("useFeedback sound", () => {
  const setVisibility = (state: "hidden" | "visible") => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  };

  test("plays place with the face count and level size", () => {
    renderHook(() => useFeedback());
    act(() => gameStore.getState().placeFace(solution[0]));
    expect(sound.play).toHaveBeenCalledWith("place", 1, n);
    act(() => gameStore.getState().placeFace(solution[1]));
    expect(sound.play).toHaveBeenLastCalledWith("place", 2, n);
  });

  test("plays wrong", () => {
    renderHook(() => useFeedback());
    act(() => gameStore.getState().placeFace(wrongCell));
    expect(sound.play).toHaveBeenCalledWith("wrong", expect.any(Number), n);
  });

  test("sound and haptics are gated independently, at event time", () => {
    renderHook(() => useFeedback());
    settingsStore.getState().set({ sound: false });
    act(() => gameStore.getState().placeFace(solution[0]));
    expect(sound.play).not.toHaveBeenCalled();
    expect(play()).toHaveBeenCalledTimes(1);
    settingsStore.getState().set({ sound: true, haptics: false });
    act(() => gameStore.getState().placeFace(solution[1]));
    expect(sound.play).toHaveBeenCalledTimes(1);
    expect(play()).toHaveBeenCalledTimes(1);
  });

  test("restart and startLevel are silent", () => {
    renderHook(() => useFeedback());
    act(() => {
      gameStore.getState().placeFace(solution[0]);
    });
    vi.mocked(sound.play).mockClear();
    act(() => {
      gameStore.getState().restart();
      gameStore.getState().startLevel(level);
    });
    expect(sound.play).not.toHaveBeenCalled();
  });

  const gestures = ["pointerup", "touchend", "click", "keydown"];

  test.each(gestures)("unlocks on %s", (type) => {
    renderHook(() => useFeedback());
    window.dispatchEvent(new Event(type));
    expect(sound.unlock).toHaveBeenCalledTimes(1);
  });

  test("pointerdown alone does not unlock", () => {
    renderHook(() => useFeedback());
    window.dispatchEvent(new Event("pointerdown"));
    expect(sound.unlock).not.toHaveBeenCalled();
  });

  test("stops listening once the context is running", async () => {
    vi.mocked(sound.unlock).mockResolvedValue(true);
    renderHook(() => useFeedback());
    await act(async () => {
      window.dispatchEvent(new Event("click"));
    });
    window.dispatchEvent(new Event("click"));
    window.dispatchEvent(new Event("keydown"));
    expect(sound.unlock).toHaveBeenCalledTimes(1);
  });

  test("keeps listening while the context is not running", async () => {
    vi.mocked(sound.unlock).mockResolvedValue(false);
    renderHook(() => useFeedback());
    await act(async () => {
      window.dispatchEvent(new Event("touchend"));
    });
    window.dispatchEvent(new Event("click"));
    expect(sound.unlock).toHaveBeenCalledTimes(2);
  });

  test("removes the unlock listeners on unmount", () => {
    const { unmount } = renderHook(() => useFeedback());
    unmount();
    window.dispatchEvent(new Event("click"));
    expect(sound.unlock).not.toHaveBeenCalled();
  });

  test("suspends when hidden and resumes when visible", () => {
    renderHook(() => useFeedback());
    setVisibility("hidden");
    expect(sound.suspend).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    expect(sound.resume).toHaveBeenCalledTimes(1);
  });

  test("suspends on pagehide", () => {
    renderHook(() => useFeedback());
    window.dispatchEvent(new Event("pagehide"));
    expect(sound.suspend).toHaveBeenCalledTimes(1);
  });

  test("stops listening to visibility on unmount", () => {
    const { unmount } = renderHook(() => useFeedback());
    unmount();
    setVisibility("hidden");
    window.dispatchEvent(new Event("pagehide"));
    expect(sound.suspend).not.toHaveBeenCalled();
  });
});

describe("useFeedback fx", () => {
  afterEach(() => vi.useRealTimers());

  test("sets fx for every outcome, independent of haptics and sound", () => {
    settingsStore.getState().set({ haptics: false, sound: false });
    renderHook(() => useFeedback());
    act(() => gameStore.getState().placeFace(solution[0]));
    expect(fxStore.getState().last).toMatchObject({
      kind: "place",
      cell: solution[0],
    });
    act(() => gameStore.getState().placeFace(wrongCell));
    expect(fxStore.getState().last).toMatchObject({
      kind: "wrong",
      cell: wrongCell,
      hearts: 2,
    });
  });

  test("a non-outcome change does not touch fx", () => {
    renderHook(() => useFeedback());
    act(() => gameStore.getState().placeFace(solution[0]));
    const seq = fxStore.getState().last?.seq;
    act(() => gameStore.getState().toggleMark(wrongCell));
    expect(fxStore.getState().last?.seq).toBe(seq);
  });

  test("clears on level start and restart", () => {
    renderHook(() => useFeedback());
    act(() => gameStore.getState().placeFace(solution[0]));
    act(() => gameStore.getState().restart());
    expect(fxStore.getState().last).toBeNull();
    act(() => gameStore.getState().placeFace(solution[0]));
    act(() => gameStore.getState().startLevel(level));
    expect(fxStore.getState().last).toBeNull();
  });

  test("clears itself after FX_MS, restarted by each outcome", () => {
    vi.useFakeTimers();
    renderHook(() => useFeedback());
    act(() => gameStore.getState().placeFace(solution[0]));
    act(() => vi.advanceTimersByTime(FX_MS - 50));
    act(() => gameStore.getState().placeFace(solution[1]));
    act(() => vi.advanceTimersByTime(FX_MS - 50));
    expect(fxStore.getState().last).not.toBeNull();
    act(() => vi.advanceTimersByTime(50));
    expect(fxStore.getState().last).toBeNull();
  });

  test("unmount cancels the timer", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useFeedback());
    act(() => gameStore.getState().placeFace(solution[0]));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
