import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Cell } from "../../engine";
import { CellView } from "./Cell";
import { HOLD_DELAY_MS, HOLD_MS, HOLD_TOTAL_MS } from "./hold";
import { GLYPH_COLOR, REGION_BG, REGION_NAMES, WRONG_COLOR } from "./palette";

type Props = Parameters<typeof CellView>[0];

function renderCell(over: Partial<Props> = {}) {
  const onToggleMark = vi.fn();
  const onPlaceFace = vi.fn();
  const props: Props = {
    index: 17,
    row: 1,
    col: 2,
    region: REGION,
    state: Cell.Empty,
    isWrong: false,
    isConflict: false,
    disabled: false,
    onToggleMark,
    onPlaceFace,
    ...over,
  };
  render(<CellView {...props} />);
  return Object.assign(screen.getByRole("button"), {
    onToggleMark: props.onToggleMark as ReturnType<typeof vi.fn>,
    onPlaceFace: props.onPlaceFace as ReturnType<typeof vi.fn>,
  });
}

const REGION = 5;
const NAME = REGION_NAMES[REGION];

const icon = (b: HTMLElement) => b.querySelector("[data-icon]");

describe("CellView", () => {
  test("labels each state with row, column, region and state", () => {
    expect(renderCell().getAttribute("aria-label")).toBe(
      `Row 2, column 3, ${NAME} region, empty`,
    );
  });

  test.each([
    [{ state: Cell.Mark }, "marked", "mark"],
    [{ state: Cell.Face }, "face", "face"],
    [{ state: Cell.Mark, isWrong: true }, "wrong", "wrong"],
  ] as const)("%j shows %s with the %s icon", (over, label, kind) => {
    const b = renderCell(over);
    expect(b.getAttribute("aria-label")).toBe(
      `Row 2, column 3, ${NAME} region, ${label}`,
    );
    expect(icon(b)?.getAttribute("data-icon")).toBe(kind);
  });

  test("an empty cell has no icon", () => {
    expect(icon(renderCell())).toBeNull();
  });

  test("only the wrong icon is red", () => {
    const wrong = icon(renderCell({ state: Cell.Mark, isWrong: true }));
    expect(wrong?.getAttribute("stroke")).toBe(WRONG_COLOR);
    cleanup();
    const mark = icon(renderCell({ state: Cell.Mark }));
    expect(mark?.getAttribute("stroke")).toBe(GLYPH_COLOR);
  });

  test("uses the region background", () => {
    expect(renderCell({ region: 3 }).className).toContain(REGION_BG[3]);
  });

  test("conflict adds a ring and data-conflict", () => {
    const b = renderCell({ isConflict: true });
    expect(b.dataset.conflict).toBe("true");
    expect(b.className).toContain("ring-");
  });

  test("no conflict means no ring", () => {
    const b = renderCell();
    expect(b.dataset.conflict).toBeUndefined();
    expect(b.className).not.toContain("ring-");
  });

  test("cells draw only thin grid borders (thick edges are Board's overlay)", () => {
    const b = renderCell();
    expect(b.className).not.toContain("border-r-4");
    expect(b.className).not.toContain("border-b-4");
    expect(b.className).toContain("border-r");
    expect(b.className).toContain("border-b");
  });

  test("a single click toggles the mark and never places a face", async () => {
    const b = renderCell();
    await userEvent.click(b);
    expect(b.onToggleMark).toHaveBeenCalledExactlyOnceWith(17);
    expect(b.onPlaceFace).not.toHaveBeenCalled();
  });

  test("a double-click toggles twice and never places a face", async () => {
    const b = renderCell();
    await userEvent.dblClick(b);
    expect(b.onToggleMark).toHaveBeenCalledTimes(2);
    expect(b.onPlaceFace).not.toHaveBeenCalled();
  });

  test.each(["x", "X"])("key %s toggles the mark", async (key) => {
    const b = renderCell();
    b.focus();
    await userEvent.keyboard(key);
    expect(b.onToggleMark).toHaveBeenCalledExactlyOnceWith(17);
    expect(b.onPlaceFace).not.toHaveBeenCalled();
  });

  test("Enter keeps the native click and toggles", async () => {
    const b = renderCell();
    b.focus();
    await userEvent.keyboard("{Enter}");
    expect(b.onToggleMark).toHaveBeenCalledExactlyOnceWith(17);
    expect(b.onPlaceFace).not.toHaveBeenCalled();
  });

  test("ctrl/meta/alt combos and held-key repeats do nothing", () => {
    const b = renderCell();
    for (const mod of ["ctrlKey", "metaKey", "altKey"])
      fireEvent.keyDown(b, { key: "x", [mod]: true });
    fireEvent.keyDown(b, { key: "x", repeat: true });
    expect(b.onToggleMark).not.toHaveBeenCalled();
    expect(b.onPlaceFace).not.toHaveBeenCalled();
  });

  test("a held Enter does not toggle on auto-repeat", () => {
    const b = renderCell();
    expect(fireEvent.keyDown(b, { key: "Enter", repeat: true })).toBe(false);
    expect(fireEvent.keyDown(b, { key: "Enter" })).toBe(true);
  });

  test("modifier combos are not default-prevented", () => {
    const b = renderCell();
    for (const mod of ["ctrlKey", "metaKey", "altKey"]) {
      expect(fireEvent.keyDown(b, { key: "x", [mod]: true })).toBe(true);
      expect(fireEvent.keyDown(b, { key: " ", [mod]: true })).toBe(true);
      expect(fireEvent.keyUp(b, { key: " ", [mod]: true })).toBe(true);
    }
  });

  test("handled keys are default-prevented, including Space on keyup", () => {
    const b = renderCell();
    expect(fireEvent.keyDown(b, { key: "x" })).toBe(false);
    expect(fireEvent.keyDown(b, { key: " " })).toBe(false);
    expect(fireEvent.keyUp(b, { key: " " })).toBe(false);
    expect(fireEvent.keyDown(b, { key: "a" })).toBe(true);
    expect(fireEvent.keyUp(b, { key: "a" })).toBe(true);
  });

  test("disabled is reflected on the button", () => {
    expect(renderCell({ disabled: true })).toBeDisabled();
    cleanup();
    expect(renderCell({ disabled: false })).toBeEnabled();
  });

  test("a disabled cell ignores clicks and keys", async () => {
    const b = renderCell({ disabled: true });
    await userEvent.dblClick(b);
    b.focus();
    await userEvent.keyboard("x ");
    expect(b.onToggleMark).not.toHaveBeenCalled();
    expect(b.onPlaceFace).not.toHaveBeenCalled();
  });

  describe("hold to place a face", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const down = (b: HTMLElement, over = {}) =>
      fireEvent.pointerDown(b, { button: 0, pointerId: 1, ...over });
    const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
    const holding = (b: HTMLElement) => b.dataset.holding;

    test("holding the pointer for HOLD_TOTAL_MS places a face once", () => {
      const b = renderCell();
      down(b);
      tick(HOLD_TOTAL_MS - 1);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
      tick(1);
      expect(b.onPlaceFace).toHaveBeenCalledExactlyOnceWith(17);
      tick(5000);
      expect(b.onPlaceFace).toHaveBeenCalledTimes(1);
    });

    test.each(["pointerUp", "pointerLeave", "pointerCancel"] as const)(
      "%s before HOLD_TOTAL_MS cancels and the timer stays dead",
      (ev) => {
        const b = renderCell();
        down(b);
        tick(HOLD_TOTAL_MS - 100);
        fireEvent[ev](b, { pointerId: 1 });
        tick(5000);
        expect(b.onPlaceFace).not.toHaveBeenCalled();
        expect(holding(b)).toBeUndefined();
      },
    );

    test("a short press followed by click toggles once", () => {
      const b = renderCell();
      down(b);
      tick(100);
      fireEvent.pointerUp(b);
      fireEvent.click(b, { detail: 1 });
      expect(b.onToggleMark).toHaveBeenCalledExactlyOnceWith(17);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
    });

    test("a completed hold swallows its trailing click", () => {
      const b = renderCell();
      down(b);
      tick(HOLD_TOTAL_MS);
      fireEvent.pointerUp(b);
      fireEvent.click(b, { detail: 1 });
      expect(b.onToggleMark).not.toHaveBeenCalled();
      // The swallow resets, so a later click toggles again.
      fireEvent.click(b, { detail: 1 });
      expect(b.onToggleMark).toHaveBeenCalledTimes(1);
    });

    test("a stale swallow flag is reset by the next pointerdown", () => {
      const b = renderCell();
      down(b);
      tick(HOLD_TOTAL_MS);
      fireEvent.pointerLeave(b); // released elsewhere: no click arrives
      down(b);
      fireEvent.pointerUp(b);
      fireEvent.click(b, { detail: 1 });
      expect(b.onToggleMark).toHaveBeenCalledTimes(1);
    });

    test("a second input source while holding does not corrupt the swallow", () => {
      const b = renderCell();
      down(b);
      tick(100);
      fireEvent.keyDown(b, { key: " " }); // ignored: a hold is running
      tick(HOLD_TOTAL_MS);
      expect(b.onPlaceFace).toHaveBeenCalledTimes(1);
      fireEvent.pointerUp(b);
      fireEvent.click(b, { detail: 1 });
      expect(b.onToggleMark).not.toHaveBeenCalled(); // pointer hold's click
    });

    test("a pointer hold then pointerleave does not swallow a later Enter click", () => {
      const b = renderCell();
      down(b);
      tick(HOLD_TOTAL_MS);
      fireEvent.pointerLeave(b); // dragged off: the trailing click never comes
      fireEvent.keyDown(b, { key: "Enter" });
      fireEvent.click(b, { detail: 0 });
      expect(b.onToggleMark).toHaveBeenCalledExactlyOnceWith(17);
    });

    test("a pointer hold then a key press does not swallow the Enter click", () => {
      const b = renderCell();
      down(b);
      tick(HOLD_TOTAL_MS);
      fireEvent.keyDown(b, { key: "Enter" });
      fireEvent.click(b, { detail: 0 });
      expect(b.onToggleMark).toHaveBeenCalledExactlyOnceWith(17);
    });

    test("clicks toggle every time, including detail >= 2", () => {
      const b = renderCell();
      for (const detail of [1, 2, 3]) fireEvent.click(b, { detail });
      expect(b.onToggleMark).toHaveBeenCalledTimes(3);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
    });

    test("non-primary buttons do not start a hold", () => {
      const b = renderCell();
      down(b, { button: 2 });
      tick(HOLD_TOTAL_MS * 2);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
      expect(holding(b)).toBeUndefined();
    });

    test("data-holding and the glow track the hold lifecycle", () => {
      const b = renderCell();
      expect(holding(b)).toBeUndefined();
      expect(b.querySelector("[data-hold-glow]")).toBeNull();
      down(b);
      expect(holding(b)).toBeUndefined();
      tick(HOLD_DELAY_MS);
      expect(holding(b)).toBe("true");
      const glow = b.querySelector("[data-hold-glow]") as SVGElement;
      expect(glow.getAttribute("class")).toContain("pointer-events-none");
      expect(glow.querySelector("rect")?.style.animationDuration).toBe(
        `${HOLD_MS}ms`,
      );
      tick(HOLD_MS);
      expect(holding(b)).toBeUndefined();
      expect(b.querySelector("[data-hold-glow]")).toBeNull();
    });

    test("no glow before the delay; a short click never shows it", () => {
      const b = renderCell();
      down(b);
      tick(HOLD_DELAY_MS - 1);
      expect(holding(b)).toBeUndefined();
      expect(b.querySelector("[data-hold-glow]")).toBeNull();
      fireEvent.pointerUp(b);
      fireEvent.click(b, { detail: 1 });
      expect(b.onToggleMark).toHaveBeenCalledExactlyOnceWith(17);
      tick(5000);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
    });

    test("the face is not placed after HOLD_MS, only after the delay too", () => {
      const b = renderCell();
      down(b);
      tick(HOLD_MS);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
      tick(HOLD_DELAY_MS);
      expect(b.onPlaceFace).toHaveBeenCalledTimes(1);
    });

    test("releasing during the glow cancels it", () => {
      const b = renderCell();
      down(b);
      tick(HOLD_DELAY_MS + 100);
      expect(holding(b)).toBe("true");
      fireEvent.pointerUp(b);
      expect(holding(b)).toBeUndefined();
      tick(5000);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
    });

    test("releasing pointer capture lets touch pointers fire leave", () => {
      const b = renderCell();
      const release = vi.fn();
      b.hasPointerCapture = () => true;
      b.releasePointerCapture = release;
      down(b, { pointerId: 7 });
      expect(release).toHaveBeenCalledWith(7);
    });

    test("a missing pointer-capture API does not break pointerdown", () => {
      const b = renderCell();
      expect(() => down(b)).not.toThrow();
      tick(HOLD_DELAY_MS);
      expect(holding(b)).toBe("true");
    });

    test("a disabled cell never holds", () => {
      const b = renderCell({ disabled: true });
      down(b);
      tick(HOLD_TOTAL_MS * 2);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
      expect(holding(b)).toBeUndefined();
    });

    test("becoming disabled mid-hold cancels it", () => {
      const onPlaceFace = vi.fn();
      const props: Props = {
        index: 1,
        row: 0,
        col: 0,
        region: 0,
        state: Cell.Empty,
        isWrong: false,
        isConflict: false,
        disabled: false,
        onToggleMark: vi.fn(),
        onPlaceFace,
      };
      const { rerender } = render(<CellView {...props} />);
      const b = screen.getByRole("button");
      down(b);
      tick(HOLD_DELAY_MS + 10);
      expect(holding(b)).toBe("true");
      rerender(<CellView {...props} disabled />);
      expect(holding(b)).toBeUndefined();
      tick(HOLD_TOTAL_MS * 2);
      expect(onPlaceFace).not.toHaveBeenCalled();
    });

    test("unmounting mid-hold clears the timer", () => {
      const b = renderCell();
      down(b);
      cleanup();
      tick(HOLD_TOTAL_MS * 2);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
    });

    test("the context menu is prevented", () => {
      expect(fireEvent.contextMenu(renderCell())).toBe(false);
    });

    test("holding Space for HOLD_TOTAL_MS places a face once, no toggle", () => {
      const b = renderCell();
      fireEvent.keyDown(b, { key: " " });
      expect(holding(b)).toBeUndefined();
      tick(HOLD_DELAY_MS);
      expect(holding(b)).toBe("true");
      tick(HOLD_MS - 1);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
      tick(1);
      expect(b.onPlaceFace).toHaveBeenCalledExactlyOnceWith(17);
      expect(holding(b)).toBeUndefined();
      fireEvent.keyUp(b, { key: " " });
      expect(b.onToggleMark).not.toHaveBeenCalled();
    });

    test("releasing Space early does nothing", () => {
      const b = renderCell();
      fireEvent.keyDown(b, { key: " " });
      tick(HOLD_TOTAL_MS - 100);
      fireEvent.keyUp(b, { key: " " });
      tick(5000);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
      expect(b.onToggleMark).not.toHaveBeenCalled();
    });

    test("blur cancels a Space hold", () => {
      const b = renderCell();
      fireEvent.keyDown(b, { key: " " });
      fireEvent.blur(b);
      tick(5000);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
    });

    test("Space repeats neither restart nor retrigger, and do not re-fire without keyup", () => {
      const b = renderCell();
      fireEvent.keyDown(b, { key: " " });
      tick(HOLD_TOTAL_MS - 100);
      expect(fireEvent.keyDown(b, { key: " ", repeat: true })).toBe(false);
      tick(100);
      expect(b.onPlaceFace).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(b, { key: " ", repeat: true });
      tick(HOLD_TOTAL_MS * 2);
      expect(b.onPlaceFace).toHaveBeenCalledTimes(1);
    });

    test("Space with a modifier does not hold", () => {
      const b = renderCell();
      for (const mod of ["ctrlKey", "metaKey", "altKey"])
        fireEvent.keyDown(b, { key: " ", [mod]: true });
      tick(HOLD_TOTAL_MS * 2);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
      expect(holding(b)).toBeUndefined();
    });

    test("x toggles immediately and Enter does not hold", () => {
      const b = renderCell();
      fireEvent.keyDown(b, { key: "x" });
      expect(b.onToggleMark).toHaveBeenCalledTimes(1);
      fireEvent.keyDown(b, { key: "Enter" });
      expect(holding(b)).toBeUndefined();
      tick(HOLD_TOTAL_MS * 2);
      expect(b.onPlaceFace).not.toHaveBeenCalled();
    });
  });
});
