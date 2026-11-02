import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { idleState } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { useUndoShortcuts } from "./useUndoShortcuts";

function press(init: KeyboardEventInit): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { cancelable: true, ...init });
  act(() => {
    window.dispatchEvent(e);
  });
  return e;
}

const marked = () => {
  const s = gameStore.getState();
  if (s.status === "idle") throw new Error("idle");
  return s.history.length;
};
const future = () => {
  const s = gameStore.getState();
  if (s.status === "idle") throw new Error("idle");
  return s.future.length;
};

beforeEach(() => {
  gameStore.setState(idleState, false);
  gameStore.getState().startLevel(level);
  gameStore.getState().toggleMark(1);
  gameStore.getState().toggleMark(2);
});

const undoCombos: KeyboardEventInit[] = [
  { key: "z" },
  { key: "z", ctrlKey: true },
  { key: "z", metaKey: true },
];
const redoCombos: KeyboardEventInit[] = [
  { key: "Z", shiftKey: true },
  { key: "z", shiftKey: true, ctrlKey: true },
  { key: "Z", shiftKey: true, metaKey: true },
  { key: "y", ctrlKey: true },
];

describe("useUndoShortcuts", () => {
  test.each(undoCombos)("undoes on %o", (init) => {
    renderHook(() => useUndoShortcuts());
    const e = press(init);
    expect(marked()).toBe(1);
    expect(future()).toBe(1);
    expect(e.defaultPrevented).toBe(true);
  });

  test.each(redoCombos)("redoes on %o", (init) => {
    renderHook(() => useUndoShortcuts());
    gameStore.getState().undo();
    const e = press(init);
    expect(marked()).toBe(2);
    expect(future()).toBe(0);
    expect(e.defaultPrevented).toBe(true);
  });

  test("ignores auto-repeat", () => {
    renderHook(() => useUndoShortcuts());
    const e = press({ key: "z", repeat: true });
    expect(marked()).toBe(2);
    expect(e.defaultPrevented).toBe(false);
  });

  test("ignores Alt combos", () => {
    renderHook(() => useUndoShortcuts());
    press({ key: "z", altKey: true });
    press({ key: "z", ctrlKey: true, altKey: true });
    expect(marked()).toBe(2);
  });

  test("ignores other keys without preventing default", () => {
    renderHook(() => useUndoShortcuts());
    const e = press({ key: "x" });
    expect(marked()).toBe(2);
    expect(e.defaultPrevented).toBe(false);
  });

  test("does nothing when paused, won or lost", () => {
    renderHook(() => useUndoShortcuts());
    for (const status of ["paused", "won", "lost"] as const) {
      gameStore.setState({ status }, false);
      const e = press({ key: "z" });
      expect(marked()).toBe(2);
      expect(e.defaultPrevented).toBe(false);
    }
  });

  test("removes its listener on unmount", () => {
    const { unmount } = renderHook(() => useUndoShortcuts());
    unmount();
    press({ key: "z" });
    expect(marked()).toBe(2);
  });
});
