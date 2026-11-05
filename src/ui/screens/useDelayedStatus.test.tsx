import { act, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { GameStatus } from "../../store/game";
import {
  LOSE_DELAY_MS,
  useDelayedStatus,
  WIN_DELAY_MS,
} from "./useDelayedStatus";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const setup = (initial: GameStatus) =>
  renderHook(
    ({ s }: { s: GameStatus }) =>
      useDelayedStatus(s, WIN_DELAY_MS, LOSE_DELAY_MS),
    { initialProps: { s: initial } },
  );

describe("useDelayedStatus", () => {
  test("exports the delays", () => {
    expect(WIN_DELAY_MS).toBe(900);
    expect(LOSE_DELAY_MS).toBe(450);
  });

  test("holds the previous status for the win delay", () => {
    const { result, rerender } = setup("playing");
    rerender({ s: "won" });
    expect(result.current.status).toBe("playing");
    expect(result.current.pending).toBe(true);
    act(() => vi.advanceTimersByTime(WIN_DELAY_MS - 1));
    expect(result.current.status).toBe("playing");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.status).toBe("won");
    expect(result.current.pending).toBe(false);
  });

  test("uses the loss delay for a loss", () => {
    const { result, rerender } = setup("playing");
    rerender({ s: "lost" });
    act(() => vi.advanceTimersByTime(LOSE_DELAY_MS - 1));
    expect(result.current.status).toBe("playing");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.status).toBe("lost");
  });

  test("skip() releases immediately", () => {
    const { result, rerender } = setup("playing");
    rerender({ s: "won" });
    act(() => result.current.skip());
    expect(result.current.status).toBe("won");
    expect(result.current.pending).toBe(false);
  });

  test("non-final statuses pass through immediately, cancelling a pending one", () => {
    const { result, rerender } = setup("playing");
    rerender({ s: "won" });
    rerender({ s: "playing" });
    expect(result.current.status).toBe("playing");
    expect(result.current.pending).toBe(false);
    act(() => vi.advanceTimersByTime(WIN_DELAY_MS * 2));
    expect(result.current.status).toBe("playing");
    rerender({ s: "paused" });
    expect(result.current.status).toBe("paused");
  });

  test("a final status present on mount is not delayed", () => {
    const { result } = setup("won");
    expect(result.current.status).toBe("won");
    expect(result.current.pending).toBe(false);
  });

  test("reduced motion makes both delays zero", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { result, rerender } = setup("playing");
    rerender({ s: "won" });
    expect(result.current.status).toBe("won");
    expect(result.current.pending).toBe(false);
    rerender({ s: "playing" });
    rerender({ s: "lost" });
    expect(result.current.status).toBe("lost");
  });

  test("a key press skips, without preventDefault", () => {
    const { result, rerender } = setup("playing");
    rerender({ s: "won" });
    let notPrevented = true;
    act(() => {
      notPrevented = fireEvent.keyDown(window, { key: "a" });
    });
    expect(notPrevented).toBe(true);
    expect(result.current.status).toBe("won");
  });

  test.each(["Shift", "Control", "Alt", "Meta"])(
    "a lone %s does not skip",
    (key) => {
      const { result, rerender } = setup("playing");
      rerender({ s: "won" });
      act(() => {
        fireEvent.keyDown(window, { key });
      });
      expect(result.current.pending).toBe(true);
    },
  );

  test("a repeating key does not skip", () => {
    const { result, rerender } = setup("playing");
    rerender({ s: "won" });
    act(() => {
      fireEvent.keyDown(window, { key: "a", repeat: true });
    });
    expect(result.current.pending).toBe(true);
  });

  test("keys are ignored when nothing is pending, and listeners are removed", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { result, rerender, unmount } = setup("playing");
    expect(add.mock.calls.filter(([t]) => t === "keydown")).toHaveLength(0);
    rerender({ s: "won" });
    expect(add.mock.calls.filter(([t]) => t === "keydown")).toHaveLength(1);
    act(() => result.current.skip());
    expect(remove.mock.calls.filter(([t]) => t === "keydown")).toHaveLength(1);
    rerender({ s: "playing" });
    rerender({ s: "lost" });
    unmount();
    expect(remove.mock.calls.filter(([t]) => t === "keydown")).toHaveLength(2);
  });

  test("unmounting clears the timer", () => {
    const { rerender, unmount } = setup("playing");
    rerender({ s: "won" });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
