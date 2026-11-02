import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Cell, emptyBoard } from "../../engine";
import {
  multiSolutionLevel7,
  uniqueLevel7 as level,
} from "../../engine/__fixtures__/levels";
import { holdCell } from "../../test/hold";
import { Board } from "./Board";
import { cellGeometry } from "./geometry";
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

  test("cell size budget uses container units and subtracts the frame border", () => {
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
    expect(cell).toContain("100cqw");
    expect(cell).toContain("100cqh");
    expect(cell).toContain("4.5rem");
    expect(cell).not.toContain("vw");
    expect(cell).not.toContain("dvh");
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
      holdCell(at(11));
      expect(h.onPlaceFace).toHaveBeenCalledExactlyOnceWith(11);
    });
  });

  describe("roving tabindex", () => {
    const renderBoard = () =>
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
    const buttons = () => screen.getAllByRole("button");

    test("only the first cell is tabbable at first", () => {
      renderBoard();
      const tabbable = buttons().filter((b) => b.tabIndex === 0);
      expect(tabbable).toEqual([buttons()[0]]);
      expect(buttons().filter((b) => b.tabIndex === -1)).toHaveLength(
        n * n - 1,
      );
    });

    test("focusing a cell makes it the tabbable one", () => {
      renderBoard();
      act(() => buttons()[7].focus());
      const tabbable = buttons().filter((b) => b.tabIndex === 0);
      expect(tabbable).toEqual([buttons()[7]]);
    });

    test("Tab lands on the active cell and a second Tab leaves the board", async () => {
      renderBoard();
      act(() => buttons()[7].focus());
      act(() => buttons()[7].blur());
      await userEvent.tab();
      expect(document.activeElement).toBe(buttons()[7]);
      await userEvent.tab();
      expect(screen.getByRole("grid").contains(document.activeElement)).toBe(
        false,
      );
    });

    test("a new level resets the tabbable cell to the first", () => {
      const props = {
        board: emptyBoard(level),
        wrong: none,
        conflicts: none,
        disabled: false,
        ...handlers(),
      };
      const { rerender } = render(<Board level={level} {...props} />);
      act(() => buttons()[7].focus());
      rerender(<Board level={multiSolutionLevel7} {...props} />);
      const tabbable = buttons().filter((b) => b.tabIndex === 0);
      expect(tabbable).toEqual([buttons()[0]]);
    });
  });

  describe("arrow-key movement", () => {
    const renderBoard = (board = emptyBoard(level), wrong = none) =>
      render(
        <Board
          level={level}
          board={board}
          wrong={wrong}
          conflicts={none}
          disabled={false}
          {...handlers()}
        />,
      );
    const buttons = () => screen.getAllByRole("button");
    const focusAt = (i: number) => act(() => buttons()[i].focus());
    const activeIndex = () =>
      buttons().indexOf(document.activeElement as HTMLElement);

    test("ArrowRight moves focus one cell right", async () => {
      renderBoard();
      focusAt(8);
      await userEvent.keyboard("{ArrowRight}");
      expect(activeIndex()).toBe(9);
    });

    test("ArrowLeft moves focus one cell left", async () => {
      renderBoard();
      focusAt(8);
      await userEvent.keyboard("{ArrowLeft}");
      expect(activeIndex()).toBe(7);
    });

    test("ArrowDown moves focus one row down", async () => {
      renderBoard();
      focusAt(8);
      await userEvent.keyboard("{ArrowDown}");
      expect(activeIndex()).toBe(8 + n);
    });
  });
});
