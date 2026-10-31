import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Cell } from "../../engine";
import { CellView } from "./Cell";
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
    thickRight: false,
    thickBottom: false,
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

  test("thick flags select thick borders, thin otherwise", () => {
    const thick = renderCell({ thickRight: true, thickBottom: true });
    expect(thick.className).toContain("border-r-4");
    expect(thick.className).toContain("border-b-4");
  });

  test("thin borders when flags are false", () => {
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

  test("a double-click toggles on the first click and places on the second", async () => {
    const b = renderCell();
    await userEvent.dblClick(b);
    expect(b.onToggleMark).toHaveBeenCalledExactlyOnceWith(17);
    expect(b.onPlaceFace).toHaveBeenCalledExactlyOnceWith(17);
  });

  test("a third click (detail >= 2) still places", async () => {
    const b = renderCell();
    await userEvent.tripleClick(b);
    expect(b.onToggleMark).toHaveBeenCalledTimes(1);
    expect(b.onPlaceFace).toHaveBeenCalledTimes(2);
  });

  test.each(["x", "X"])("key %s toggles the mark", async (key) => {
    const b = renderCell();
    b.focus();
    await userEvent.keyboard(key);
    expect(b.onToggleMark).toHaveBeenCalledExactlyOnceWith(17);
    expect(b.onPlaceFace).not.toHaveBeenCalled();
  });

  test("Space places a face without a click", async () => {
    const b = renderCell();
    b.focus();
    await userEvent.keyboard(" ");
    expect(b.onPlaceFace).toHaveBeenCalledExactlyOnceWith(17);
    expect(b.onToggleMark).not.toHaveBeenCalled();
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
    fireEvent.keyDown(b, { key: " ", repeat: true });
    expect(b.onToggleMark).not.toHaveBeenCalled();
    expect(b.onPlaceFace).not.toHaveBeenCalled();
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
});
