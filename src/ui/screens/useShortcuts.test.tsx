import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { Cell } from "../../engine";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { idleState, MAX_HEARTS } from "../../store/game";
import { createGameStore, gameStore } from "../../store/gameStore";
import { defaultSettings, settingsStore } from "../../store/settings";
import { useShortcuts } from "./useShortcuts";

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
  settingsStore.setState({ ...defaultSettings });
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

describe("useShortcuts", () => {
  test.each(undoCombos)("undoes on %o", (init) => {
    renderHook(() => useShortcuts());
    const e = press(init);
    expect(marked()).toBe(1);
    expect(future()).toBe(1);
    expect(e.defaultPrevented).toBe(true);
  });

  test.each(redoCombos)("redoes on %o", (init) => {
    renderHook(() => useShortcuts());
    gameStore.getState().undo();
    const e = press(init);
    expect(marked()).toBe(2);
    expect(future()).toBe(0);
    expect(e.defaultPrevented).toBe(true);
  });

  test("Cmd+Y does nothing", () => {
    renderHook(() => useShortcuts());
    gameStore.getState().undo();
    const e = press({ key: "y", metaKey: true });
    expect(future()).toBe(1);
    expect(e.defaultPrevented).toBe(false);
    press({ key: "y", metaKey: true, ctrlKey: true });
    expect(future()).toBe(1);
  });

  test("one z undoes exactly once", () => {
    renderHook(() => useShortcuts());
    press({ key: "z" });
    expect(marked()).toBe(1);
  });

  test("ignores auto-repeat", () => {
    renderHook(() => useShortcuts());
    const e = press({ key: "z", repeat: true });
    expect(marked()).toBe(2);
    expect(e.defaultPrevented).toBe(false);
  });

  test("ignores Alt combos", () => {
    renderHook(() => useShortcuts());
    press({ key: "z", altKey: true });
    press({ key: "z", ctrlKey: true, altKey: true });
    expect(marked()).toBe(2);
  });

  test("ignores other keys without preventing default", () => {
    renderHook(() => useShortcuts());
    const e = press({ key: "x" });
    expect(marked()).toBe(2);
    expect(e.defaultPrevented).toBe(false);
  });

  test("does nothing when paused, won or lost", () => {
    renderHook(() => useShortcuts());
    for (const status of ["paused", "won", "lost"] as const) {
      gameStore.setState({ status }, false);
      const e = press({ key: "z" });
      expect(marked()).toBe(2);
      expect(e.defaultPrevented).toBe(false);
    }
  });

  describe("f toggles the tap mode", () => {
    test("flips inputMode back and forth and prevents default", () => {
      renderHook(() => useShortcuts());
      const e = press({ key: "f" });
      expect(settingsStore.getState().inputMode).toBe("face");
      expect(e.defaultPrevented).toBe(true);
      press({ key: "f" });
      expect(settingsStore.getState().inputMode).toBe("mark");
    });

    test("ignores Shift+F and Caps-Lock capital F", () => {
      renderHook(() => useShortcuts());
      press({ key: "F", shiftKey: true });
      press({ key: "F" });
      expect(settingsStore.getState().inputMode).toBe("mark");
    });

    test("ignores modified f, repeats, and non-playing states", () => {
      renderHook(() => useShortcuts());
      press({ key: "f", ctrlKey: true });
      press({ key: "f", metaKey: true });
      press({ key: "f", repeat: true });
      gameStore.setState({ status: "paused" }, false);
      press({ key: "f" });
      expect(settingsStore.getState().inputMode).toBe("mark");
    });

    test("still works during a hold", () => {
      renderHook(() => useShortcuts({ holdOwner: { current: 5 } }));
      press({ key: "f" });
      expect(settingsStore.getState().inputMode).toBe("face");
    });
  });

  describe("during a hold", () => {
    const held = { current: 5 as number | null };
    afterEach(() => {
      held.current = 5;
    });

    test("undo does nothing and is not prevented", () => {
      renderHook(() => useShortcuts({ holdOwner: held }));
      const e = press({ key: "z" });
      expect(marked()).toBe(2);
      expect(e.defaultPrevented).toBe(false);
    });

    test("redo does nothing", () => {
      gameStore.getState().undo();
      renderHook(() => useShortcuts({ holdOwner: held }));
      press({ key: "Z", shiftKey: true });
      press({ key: "y", ctrlKey: true });
      expect(future()).toBe(1);
    });
  });

  describe("during a hold, continued", () => {
    const held = { current: 5 as number | null };
    const faces = () => {
      const st = gameStore.getState();
      if (st.status === "idle") throw new Error("idle");
      return st.board.filter((c) => c === Cell.Face).length;
    };

    test("hint does nothing and costs no heart", () => {
      held.current = 5;
      renderHook(() => useShortcuts({ holdOwner: held }));
      const e = press({ key: "h" });
      expect(faces()).toBe(0);
      expect(gameStore.getState().hearts).toBe(MAX_HEARTS);
      expect(e.defaultPrevented).toBe(false);
    });

    test("shortcuts work again once the hold ends", () => {
      held.current = 5;
      renderHook(() => useShortcuts({ holdOwner: held }));
      press({ key: "z" });
      expect(marked()).toBe(2);
      held.current = null;
      press({ key: "z" });
      expect(marked()).toBe(1);
    });

    test("Escape still pauses during a hold", () => {
      held.current = 5;
      renderHook(() => useShortcuts({ holdOwner: held }));
      press({ key: "Escape" });
      expect(gameStore.getState().status).toBe("paused");
    });
  });

  describe("Escape", () => {
    test("pauses and prevents default", () => {
      renderHook(() => useShortcuts());
      const e = press({ key: "Escape" });
      expect(gameStore.getState().status).toBe("paused");
      expect(e.defaultPrevented).toBe(true);
    });

    test.each([{ ctrlKey: true }, { metaKey: true }])("ignores %o", (mods) => {
      renderHook(() => useShortcuts());
      const e = press({ key: "Escape", ...mods });
      expect(gameStore.getState().status).toBe("playing");
      expect(e.defaultPrevented).toBe(false);
    });

    test("does not resume a paused game", () => {
      renderHook(() => useShortcuts());
      gameStore.getState().pause();
      const e = press({ key: "Escape" });
      expect(gameStore.getState().status).toBe("paused");
      expect(e.defaultPrevented).toBe(false);
    });
  });

  test("removes its listener on unmount", () => {
    const { unmount } = renderHook(() => useShortcuts());
    unmount();
    press({ key: "z" });
    expect(marked()).toBe(2);
  });

  describe("h (hint)", () => {
    const faces = () => {
      const st = gameStore.getState();
      if (st.status === "idle") throw new Error("idle");
      return st.board.filter((c) => c === Cell.Face).length;
    };

    test("hints and prevents default", () => {
      renderHook(() => useShortcuts());
      const e = press({ key: "h" });
      expect(faces()).toBe(1);
      expect(gameStore.getState().hearts).toBe(MAX_HEARTS - 1);
      expect(e.defaultPrevented).toBe(true);
    });

    test("accepts a capital H", () => {
      renderHook(() => useShortcuts());
      press({ key: "H", shiftKey: true });
      expect(faces()).toBe(1);
    });

    test.each([
      { key: "h", repeat: true },
      { key: "h", altKey: true },
      { key: "h", ctrlKey: true },
      { key: "h", metaKey: true },
    ])("ignores %o", (init) => {
      renderHook(() => useShortcuts());
      const e = press(init);
      expect(faces()).toBe(0);
      expect(e.defaultPrevented).toBe(false);
    });

    test("does nothing when paused, won or lost", () => {
      renderHook(() => useShortcuts());
      for (const status of ["paused", "won", "lost"] as const) {
        gameStore.setState({ status }, false);
        press({ key: "h" });
        expect(faces()).toBe(0);
      }
    });

    test("does nothing on the last heart", () => {
      renderHook(() => useShortcuts());
      press({ key: "h" });
      press({ key: "h" });
      expect(gameStore.getState().hearts).toBe(1);
      press({ key: "h" });
      expect(faces()).toBe(1);
      expect(gameStore.getState().hearts).toBe(1);
    });
  });
});

describe("useShortcuts options", () => {
  test("acts on the given store only", () => {
    const store = createGameStore();
    store.getState().startLevel(level);
    store.getState().toggleMark(1);
    renderHook(() => useShortcuts({ store }));
    press({ key: "z" });
    expect(marked()).toBe(2);
    const s = store.getState();
    if (s.status === "idle") throw new Error("idle");
    expect(s.future).toEqual([1]);
  });

  test("pause: false leaves Escape alone", () => {
    renderHook(() => useShortcuts({ pause: false }));
    const e = press({ key: "Escape" });
    expect(gameStore.getState().status).toBe("playing");
    expect(e.defaultPrevented).toBe(false);
  });

  test("only limits which actions the keys trigger", () => {
    renderHook(() => useShortcuts({ only: ["undo"] }));
    press({ key: "h" });
    expect(gameStore.getState().hearts).toBe(MAX_HEARTS);
    press({ key: "Z", shiftKey: true });
    expect(future()).toBe(0);
    press({ key: "z" });
    expect(future()).toBe(1);
  });
});
