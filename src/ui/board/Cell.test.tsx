import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Cell } from "../../engine";
import { CellView } from "./Cell";
import { GLYPH_COLOR, REGION_BG, WRONG_COLOR } from "./palette";

type Props = Parameters<typeof CellView>[0];

function renderCell(over: Partial<Props> = {}) {
  const props: Props = {
    index: 17,
    row: 1,
    col: 2,
    region: 5,
    thickRight: false,
    thickBottom: false,
    state: Cell.Empty,
    isWrong: false,
    isConflict: false,
    ...over,
  };
  render(<CellView {...props} />);
  return screen.getByRole("button");
}

const icon = (b: HTMLElement) => b.querySelector("[data-icon]");

describe("CellView", () => {
  test("labels each state with row, column, region and state", () => {
    expect(renderCell().getAttribute("aria-label")).toBe(
      "Row 2, column 3, teal region, empty",
    );
  });

  test.each([
    [{ state: Cell.Mark }, "marked", "mark"],
    [{ state: Cell.Face }, "face", "face"],
    [{ state: Cell.Mark, isWrong: true }, "wrong", "wrong"],
  ] as const)("%j shows %s with the %s icon", (over, label, kind) => {
    const b = renderCell(over);
    expect(b.getAttribute("aria-label")).toBe(
      `Row 2, column 3, teal region, ${label}`,
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
});
