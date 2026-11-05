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

  test("shows an outline on keyboard focus, inset past the conflict ring", () => {
    const cls = renderCell().className;
    expect(cls).toContain("focus-visible:outline-3");
    expect(cls).toContain("focus-visible:-outline-offset-8");
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

  test("a locked cell is aria-disabled but stays focusable (not natively disabled)", () => {
    const locked = renderCell({ disabled: true });
    expect(locked.getAttribute("aria-disabled")).toBe("true");
    expect(locked).toBeEnabled();
    cleanup();
    const open = renderCell({ disabled: false });
    expect(open.hasAttribute("aria-disabled")).toBe(false);
  });

  describe("a locked cell ignores input", () => {
    test("click", async () => {
      const b = renderCell({ disabled: true });
      await userEvent.click(b);
      expect(b.onToggleMark).not.toHaveBeenCalled();
    });

    test("x", async () => {
      const b = renderCell({ disabled: true });
      b.focus();
      await userEvent.keyboard("x");
      expect(b.onToggleMark).not.toHaveBeenCalled();
    });

    test("Enter", async () => {
      const b = renderCell({ disabled: true });
      b.focus();
      await userEvent.keyboard("{Enter}");
      expect(b.onToggleMark).not.toHaveBeenCalled();
    });

    test("Space-hold", async () => {
      const b = renderCell({ disabled: true });
      b.focus();
      vi.useFakeTimers();
      fireEvent.keyDown(b, { key: " " });
      act(() => vi.advanceTimersByTime(HOLD_TOTAL_MS * 2));
      vi.useRealTimers();
      expect(b.onPlaceFace).not.toHaveBeenCalled();
    });
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

    test("data-holding and onGlow track the hold lifecycle", () => {
      const onGlow = vi.fn();
      const b = renderCell({ onGlow });
      expect(holding(b)).toBeUndefined();
      down(b);
      expect(holding(b)).toBeUndefined();
      expect(onGlow).not.toHaveBeenCalled();
      tick(HOLD_DELAY_MS);
      expect(holding(b)).toBe("true");
      expect(onGlow).toHaveBeenLastCalledWith(17);
      expect(b.querySelector("[data-hold-glow]")).toBeNull();
      tick(HOLD_MS);
      expect(holding(b)).toBeUndefined();
      expect(onGlow).toHaveBeenLastCalledWith(null);
    });

    test.each([
      ["release", (b: HTMLElement) => fireEvent.pointerUp(b)],
      ["drag-off", (b: HTMLElement) => fireEvent.pointerLeave(b)],
      ["blur", (b: HTMLElement) => fireEvent.blur(b)],
    ])("onGlow(null) on %s", (_n, end) => {
      const onGlow = vi.fn();
      const b = renderCell({ onGlow });
      down(b);
      tick(HOLD_DELAY_MS);
      end(b);
      expect(onGlow).toHaveBeenLastCalledWith(null);
    });

    test("onGlow(null) when disabled mid-hold and on unmount", () => {
      const onGlow = vi.fn();
      const props = {
        index: 17,
        row: 1,
        col: 2,
        region: REGION,
        state: Cell.Empty,
        isWrong: false,
        isConflict: false,
        onToggleMark: vi.fn(),
        onPlaceFace: vi.fn(),
        onGlow,
      };
      const { rerender, unmount } = render(
        <CellView {...props} disabled={false} />,
      );
      const b = screen.getByRole("button");
      down(b);
      tick(HOLD_DELAY_MS);
      rerender(<CellView {...props} disabled={true} />);
      expect(onGlow).toHaveBeenLastCalledWith(null);
      rerender(<CellView {...props} disabled={false} />);
      down(b);
      tick(HOLD_DELAY_MS);
      expect(onGlow).toHaveBeenLastCalledWith(17);
      unmount();
      expect(onGlow).toHaveBeenLastCalledWith(null);
    });

    test("a keyboard hold reports the glow too", () => {
      const onGlow = vi.fn();
      const b = renderCell({ onGlow });
      fireEvent.keyDown(b, { key: " " });
      tick(HOLD_DELAY_MS);
      expect(onGlow).toHaveBeenLastCalledWith(17);
    });

    test("a click or tap never reports a glow", () => {
      const onGlow = vi.fn();
      const b = renderCell({ onGlow });
      down(b);
      tick(HOLD_DELAY_MS - 1);
      fireEvent.pointerUp(b);
      fireEvent.click(b, { detail: 1 });
      tick(5000);
      expect(onGlow).not.toHaveBeenCalled();
    });

    test("no glow before the delay; a short click never shows it", () => {
      const b = renderCell();
      down(b);
      tick(HOLD_DELAY_MS - 1);
      expect(holding(b)).toBeUndefined();
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

describe("CellView fx", () => {
  const wrap = (b: HTMLElement) => b.querySelector("[data-fx]");

  test("no fx wrapper without an fx prop", () => {
    expect(wrap(renderCell({ state: Cell.Face }))).toBeNull();
  });

  test.each(["place", "wrong"] as const)("%s marks the icon wrapper", (fx) => {
    const b = renderCell({
      state: fx === "place" ? Cell.Face : Cell.Mark,
      isWrong: fx === "wrong",
      fx,
      fxSeq: 1,
    });
    const w = wrap(b);
    expect(w?.getAttribute("data-fx")).toBe(fx);
    expect(w?.querySelector("[data-icon]")).not.toBeNull();
    expect(b.querySelector("[data-fx-ring]") !== null).toBe(fx === "place");
  });

  test("the icon keeps its DOM node when fx clears", () => {
    const props = {
      index: 17,
      row: 1,
      col: 2,
      region: REGION,
      state: Cell.Face,
      isWrong: false,
      isConflict: false,
      disabled: false,
      onToggleMark: vi.fn(),
      onPlaceFace: vi.fn(),
    } as const;
    const { container, rerender } = render(
      <CellView {...props} fx="place" fxSeq={1} />,
    );
    const icon = container.querySelector("[data-icon]");
    rerender(<CellView {...props} />);
    expect(container.querySelector("[data-icon]")).toBe(icon);
  });

  test("the shake is not on the button", () => {
    const b = renderCell({ state: Cell.Face, fx: "place", fxSeq: 1 });
    expect(b.hasAttribute("data-fx")).toBe(false);
  });

  test("a new seq remounts the wrapper so the effect restarts", () => {
    const props = {
      index: 17,
      row: 1,
      col: 2,
      region: REGION,
      state: Cell.Face,
      isWrong: false,
      isConflict: false,
      disabled: false,
      onToggleMark: vi.fn(),
      onPlaceFace: vi.fn(),
    } as const;
    const { container, rerender } = render(
      <CellView {...props} fx="place" fxSeq={1} />,
    );
    const first = wrap(container as HTMLElement);
    rerender(<CellView {...props} fx="place" fxSeq={2} />);
    expect(wrap(container as HTMLElement)).not.toBe(first);
    expect(container.querySelectorAll("[data-fx]")).toHaveLength(1);
  });
});
