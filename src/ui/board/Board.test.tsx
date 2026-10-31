import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Cell, emptyBoard } from "../../engine";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { Board } from "./Board";
import { cellGeometry } from "./geometry";
import { REGION_NAMES } from "./palette";

const n = level.size;
const none: ReadonlySet<number> = new Set();

describe("Board", () => {
  test("is an accessible grid of rows and gridcells with one button each", () => {
    render(
      <Board
        level={level}
        board={emptyBoard(level)}
        wrong={none}
        conflicts={none}
      />,
    );
    const grid = screen.getByRole("grid", { name: "Puzzle board" });
    expect(grid.getAttribute("aria-rowcount")).toBe(String(n));
    expect(grid.getAttribute("aria-colcount")).toBe(String(n));
    expect(within(grid).getAllByRole("row")).toHaveLength(n);
    const cells = within(grid).getAllByRole("gridcell");
    expect(cells).toHaveLength(n * n);
    for (const c of cells)
      expect(within(c).getAllByRole("button")).toHaveLength(1);
  });

  test("labels carry row, column and region name", () => {
    render(
      <Board
        level={level}
        board={emptyBoard(level)}
        wrong={none}
        conflicts={none}
      />,
    );
    for (const [r, c] of [
      [0, 0],
      [0, 4],
      [3, 0],
      [6, 6],
    ]) {
      const name = `Row ${r + 1}, column ${c + 1}, ${REGION_NAMES[level.regions[r][c]]} region, empty`;
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  test("shows each cell state", () => {
    const board = emptyBoard(level) as Uint8Array;
    board[1] = Cell.Mark; // (0,1) player mark
    board[2] = Cell.Face; // (0,2)
    board[3] = Cell.Mark; // (0,3) wrong
    render(
      <Board
        level={level}
        board={board}
        wrong={new Set([3])}
        conflicts={new Set([2])}
      />,
    );
    const get = (c: number) => screen.getAllByRole("button")[c];
    expect(get(0).querySelector("[data-icon]")).toBeNull();
    expect(get(0).getAttribute("aria-label")).toMatch(/empty$/);
    expect(get(1).querySelector("[data-icon=mark]")).not.toBeNull();
    expect(get(1).getAttribute("aria-label")).toMatch(/marked$/);
    expect(get(2).querySelector("[data-icon=face]")).not.toBeNull();
    expect(get(2).dataset.conflict).toBe("true");
    expect(get(3).querySelector("[data-icon=wrong]")).not.toBeNull();
    expect(get(3).getAttribute("aria-label")).toMatch(/wrong$/);
  });

  test("thick borders match cellGeometry for every cell", () => {
    render(
      <Board
        level={level}
        board={emptyBoard(level)}
        wrong={none}
        conflicts={none}
      />,
    );
    const buttons = screen.getAllByRole("button");
    for (const g of cellGeometry(level)) {
      const cls = buttons[g.index].className;
      expect(cls.includes("border-r-4")).toBe(g.thickRight);
      expect(cls.includes("border-b-4")).toBe(g.thickBottom);
    }
  });
});
