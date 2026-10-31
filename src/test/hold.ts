import { act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { HOLD_TOTAL_MS } from "../ui/board/hold";

/**
 * Press and hold an element for `ms` (default HOLD_TOTAL_MS), then release. Fake
 * timers are scoped to the gesture so userEvent-based tests keep real ones.
 */
export function holdCell(el: HTMLElement, ms = HOLD_TOTAL_MS): void {
  vi.useFakeTimers();
  try {
    fireEvent.pointerDown(el, { button: 0, pointerId: 1 });
    act(() => vi.advanceTimersByTime(ms));
    fireEvent.pointerUp(el, { pointerId: 1 });
  } finally {
    vi.useRealTimers();
  }
}
