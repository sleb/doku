import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { idleState } from "../../store/game";
import { gameStore } from "../../store/gameStore";
import { useAutoPause } from "./useAutoPause";

function hide(hidden: boolean) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (hidden ? "hidden" : "visible"),
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  hide(false);
  gameStore.setState(idleState, false);
  gameStore.getState().startLevel(level);
});

const status = () => gameStore.getState().status;

describe("useAutoPause", () => {
  test("pauses when the document becomes hidden", () => {
    renderHook(() => useAutoPause());
    act(() => hide(true));
    expect(status()).toBe("paused");
  });

  test("does not pause when the document becomes visible", () => {
    renderHook(() => useAutoPause());
    act(() => hide(false));
    expect(status()).toBe("playing");
  });

  test("pauses on window blur", () => {
    renderHook(() => useAutoPause());
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(status()).toBe("paused");
  });

  test("leaves Escape to useShortcuts", () => {
    renderHook(() => useAutoPause());
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(status()).toBe("playing");
  });

  test("has no effect when won or lost", () => {
    renderHook(() => useAutoPause());
    for (const s of ["won", "lost"] as const) {
      gameStore.setState({ status: s }, false);
      act(() => {
        window.dispatchEvent(new Event("blur"));
        hide(true);
      });
      expect(status()).toBe(s);
    }
  });

  test("removes its listeners on unmount", () => {
    const { unmount } = renderHook(() => useAutoPause());
    unmount();
    act(() => {
      window.dispatchEvent(new Event("blur"));
      hide(true);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(status()).toBe("playing");
  });
});
