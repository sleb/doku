import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Cell, emptyBoard } from "../../engine";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { Board } from "./Board";
import { cellGeometry } from "./geometry";
import { HOLD_MS } from "./hold";
import { REGION_NAMES } from "./palette";

const n = level.size;
const none: ReadonlySet<number> = new Set();
const handlers = () => ({ onToggleMark: vi.fn(), onPlaceFace: vi.fn() });

describe("Board", () => {
  test("is an accessible grid of rows and gridcells with one button each", () => {
    render(
      <Board
        level={level}
        board={emptyBoard(level)}
        wrong={none}
        conflicts={none}
        disabled={false}
        {...handlers()}
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
        disabled={false}
        {...handlers()}
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
        disabled={false}
        {...handlers()}
      />,
    );
    const get = (c: number) =>
      screen.getByRole("button", {
        name: new RegExp(`^Row 1, column ${c + 1},`),
      });
    expect(get(0).querySelector("[data-icon]")).toBeNull();
    expect(get(0).getAttribute("aria-label")).toMatch(/empty$/);
    expect(get(1).querySelector("[data-icon=mark]")).not.toBeNull();
    expect(get(1).getAttribute("aria-label")).toMatch(/marked$/);
    expect(get(2).querySelector("[data-icon=face]")).not.toBeNull();
    expect(get(2).dataset.conflict).toBe("true");
    expect(get(3).querySelector("[data-icon=wrong]")).not.toBeNull();
    expect(get(3).getAttribute("aria-label")).toMatch(/wrong$/);
  });

  test("cell size budget uses dvh and subtracts the frame border", () => {
    render(
      <Board
        level={level}
        board={emptyBoard(level)}
        wrong={none}
        conflicts={none}
        disabled={false}
        {...handlers()}
      />,
    );
    const cell = screen.getByRole("grid").style.getPropertyValue("--cell");
    expect(cell).toContain("100dvh");
    expect(cell).not.toContain("100vh");
    expect(cell.match(/- 8px/g)).toHaveLength(2);
  });

  test("thick edge overlay segments match cellGeometry, and cells stay thin", () => {
    render(
      <Board
        level={level}
        board={emptyBoard(level)}
        wrong={none}
        conflicts={none}
        disabled={false}
        {...handlers()}
      />,
    );
    const grid = screen.getByRole("grid");
    const edges = (kind: "right" | "bottom") =>
      Array.from(grid.querySelectorAll<HTMLElement>(`[data-edge=${kind}]`))
        .map((e) => Number(e.dataset.row) * n + Number(e.dataset.col))
        .sort((x, y) => x - y);
    const geo = cellGeometry(level);
    expect(edges("right")).toEqual(
      geo.filter((g) => g.thickRight).map((g) => g.index),
    );
    expect(edges("bottom")).toEqual(
      geo.filter((g) => g.thickBottom).map((g) => g.index),
    );
    for (const e of grid.querySelectorAll("[data-edge]"))
      expect(e).toHaveAttribute("aria-hidden", "true");
    for (const b of screen.getAllByRole("button"))
      expect(b.className).not.toContain("border-r-4");
  });

  describe("input", () => {
    const at = (i: number) => {
      const [r, c] = [Math.floor(i / n), i % n];
      return screen.getByRole("button", {
        name: new RegExp(`^Row ${r + 1}, column ${c + 1},`),
      });
    };
    const mixedBoard = () => {
      const board = emptyBoard(level) as Uint8Array;
      board[1] = Cell.Mark; // player's own mark
      board[2] = Cell.Face;
      board[3] = Cell.Mark; // wrong
      return board;
    };
    const renderMixed = (disabled: boolean) => {
      const h = handlers();
      render(
        <Board
          level={level}
          board={mixedBoard()}
          wrong={new Set([3])}
          conflicts={none}
          disabled={disabled}
          {...h}
        />,
      );
      return h;
    };

    test("empty and own-mark cells are enabled; face and wrong cells disabled", () => {
      renderMixed(false);
      expect(at(0)).toBeEnabled();
      expect(at(1)).toBeEnabled();
      expect(at(2)).toBeDisabled();
      expect(at(3)).toBeDisabled();
    });

    test("a disabled board disables every cell", () => {
      renderMixed(true);
      for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    });

    test("click and hold pass the flat index to the callbacks", async () => {
      const h = renderMixed(false);
      await userEvent.click(at(10));
      expect(h.onToggleMark).toHaveBeenCalledExactlyOnceWith(10);
      expect(h.onPlaceFace).not.toHaveBeenCalled();
      vi.useFakeTimers();
      try {
        fireEvent.pointerDown(at(11), { button: 0, pointerId: 1 });
        act(() => vi.advanceTimersByTime(HOLD_MS));
      } finally {
        vi.useRealTimers();
      }
      expect(h.onPlaceFace).toHaveBeenCalledExactlyOnceWith(11);
    });
  });
});
