import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { haptics } from "../../platform/haptics";
import { sound } from "../../platform/sound";
import {
  idleState,
  pause as pauseState,
  startLevel as startState,
} from "../../store/game";
import { createGameStore, gameStore } from "../../store/gameStore";
import { progressStore } from "../../store/progress";
import { settingsStore } from "../../store/settings";
import { announcerStore } from "../a11y/announcerStore";
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
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  announcerStore.getState().reset();
  settingsStore.getState().set({ seenTutorial: true });
  progressStore.setState({ bestMs: {} });
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

  test("a clock tick does no board scan", () => {
    renderHook(() => useFeedback());
    const board = gameStore.getState().board;
    if (!board) throw new Error("no board");
    const filter = vi.spyOn(board, "filter");
    act(() => gameStore.getState().tick(16));
    expect(filter).not.toHaveBeenCalled();
    expect(play()).not.toHaveBeenCalled();
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

  const gestures = [
    "pointerdown",
    "touchstart",
    "pointerup",
    "touchend",
    "click",
    "keydown",
  ];

  test.each(gestures)("unlocks on %s", (type) => {
    renderHook(() => useFeedback());
    window.dispatchEvent(new Event(type));
    expect(sound.unlock).toHaveBeenCalledTimes(1);
  });

  test("unlock runs before a bubble-phase handler below the window", () => {
    renderHook(() => useFeedback());
    const el = document.createElement("button");
    document.body.append(el);
    let unlocked = -1;
    el.addEventListener("click", () => {
      unlocked = vi.mocked(sound.unlock).mock.calls.length;
    });
    el.click();
    el.remove();
    expect(unlocked).toBe(1);
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

describe("useFeedback announcements", () => {
  const text = () => announcerStore.getState().text;
  const describeLevel = () => ({ number: 3, count: 20 });
  const mount = (opts = {}) =>
    renderHook(() => useFeedback(gameStore, { describeLevel, ...opts }));

  afterEach(() => vi.unstubAllGlobals());

  test("announces place and wrong, independent of haptics and sound", () => {
    settingsStore.getState().set({ haptics: false, sound: false });
    mount();
    act(() => gameStore.getState().placeFace(solution[0]));
    expect(text()).toBe(
      `Face placed, row ${Math.floor(solution[0] / n) + 1}, column ${(solution[0] % n) + 1}. 1 of ${n} placed.`,
    );
    act(() => gameStore.getState().placeFace(wrongCell));
    expect(text()).toMatch(
      /^Not there\. Row \d+, column \d+ is wrong\. 2 hearts left\.$/,
    );
  });

  test("an elimination hint announces its message, plays place feedback, sets fx with no cell", () => {
    mount();
    act(() => gameStore.getState().hint());
    act(() => gameStore.getState().hint());
    expect(text()).toMatch(/cannot hold a face/);
    expect(text()).not.toMatch(/Face placed/);
    expect(play()).toHaveBeenLastCalledWith("place");
    expect(vi.mocked(sound.play)).toHaveBeenLastCalledWith(
      "place",
      expect.any(Number),
      n,
    );
    const fx = fxStore.getState().last;
    expect(fx?.kind).toBe("hint");
    expect(fx?.cell).toBeUndefined();
  });

  test("a placement hint announces the message and where the face went", () => {
    mount();
    act(() => gameStore.getState().hint());
    expect(text()).toMatch(
      /only one cell left.* Face placed, row \d+, column \d+\.$/,
    );
  });

  test("a hint is spoken with region numbers under the accessible palette", () => {
    settingsStore.getState().set({ palette: "accessible" });
    mount();
    act(() => gameStore.getState().hint());
    expect(text()).toMatch(/egion \d/);
    expect(text()).not.toMatch(/the \w+ region/);
    settingsStore.getState().set({ palette: "default" });
  });

  test("a free re-ask of the same hint is silent", () => {
    mount();
    act(() => gameStore.getState().hint());
    act(() => gameStore.getState().hint());
    const said = text();
    play().mockClear();
    act(() => gameStore.getState().hint());
    act(() => gameStore.getState().hint());
    expect(text()).toBe(said);
  });

  test("the tutorial flag drops the hearts sentence", () => {
    mount({ tutorial: true });
    act(() => gameStore.getState().placeFace(wrongCell));
    expect(text()).not.toMatch(/heart/);
  });

  test("announces a win with the time and New best", () => {
    mount();
    act(() => {
      for (const c of solution.slice(0, -1)) gameStore.getState().placeFace(c);
      gameStore.setState({ elapsedMs: 83_000 });
    });
    progressStore.setState({ bestMs: { [level.id]: 83_000 } });
    act(() => gameStore.getState().placeFace(solution[solution.length - 1]));
    expect(text()).toBe("Solved in 1 minute 23 seconds. New best.");
  });

  test("a win slower than the best has no New best", () => {
    mount();
    progressStore.setState({ bestMs: { [level.id]: 10_000 } });
    act(() => {
      for (const c of solution.slice(0, -1)) gameStore.getState().placeFace(c);
      gameStore.setState({ elapsedMs: 83_000 });
      gameStore.getState().placeFace(solution[solution.length - 1]);
    });
    expect(text()).toBe("Solved in 1 minute 23 seconds.");
  });

  test("announces a loss", () => {
    mount();
    const wrongs = Array.from({ length: n * n }, (_, i) => i).filter(
      (i) => !solution.includes(i),
    );
    act(() => {
      for (const c of wrongs.slice(0, 3)) gameStore.getState().placeFace(c);
    });
    expect(text()).toBe("Out of hearts. Retry is available.");
  });

  test("announces the level on restart and a new level, not on restore", () => {
    mount();
    act(() => gameStore.getState().placeFace(solution[0]));
    act(() => gameStore.getState().restart());
    expect(text()).toBe("Level 3 of 20, 7 by 7.");
    announcerStore.getState().reset();
    act(() => gameStore.getState().startLevel(level));
    expect(text()).toBe("Level 3 of 20, 7 by 7.");
    announcerStore.getState().reset();
    act(() => {
      gameStore.setState(idleState, false);
    });
    act(() => gameStore.setState(pauseState(startState(level))));
    expect(text()).toBe("");
  });

  test("pause and resume are announced", () => {
    mount();
    act(() => gameStore.getState().pause());
    expect(text()).toBe("Paused.");
    act(() => gameStore.getState().resume());
    expect(text()).toBe("Resumed.");
  });

  test("pause and resume are announced whether or not the tutorial was seen", () => {
    settingsStore.getState().set({ seenTutorial: false });
    mount();
    act(() => gameStore.getState().pause());
    expect(text()).toBe("Paused.");
    act(() => gameStore.getState().resume());
    expect(text()).toBe("Resumed.");
  });

  test("clears the announcer when the level resets and on unmount", () => {
    const { unmount } = mount();
    act(() => gameStore.getState().placeFace(solution[0]));
    expect(text()).not.toBe("");
    unmount();
    expect(text()).toBe("");
  });

  test("without describeLevel and an unknown level, no level text", () => {
    renderHook(() => useFeedback());
    act(() => gameStore.getState().restart());
    expect(text()).toBe("");
  });
});
