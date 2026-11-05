import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { emptyBoard } from "../../engine";
import { uniqueLevel7 as level } from "../../engine/__fixtures__/levels";
import { fxStore } from "../fx/fxStore";

const renders = vi.hoisted(() => ({ byIndex: new Map<number, number>() }));
vi.mock("./Cell", async (importActual) => {
  const { memo } = await import("react");
  const actual = await importActual<typeof import("./Cell")>();
  const Inner = actual.CellView as unknown as { type: (p: never) => unknown };
  return {
    CellView: memo((p: { index: number }) => {
      renders.byIndex.set(p.index, (renders.byIndex.get(p.index) ?? 0) + 1);
      return (Inner.type as (p: unknown) => React.ReactNode)(p);
    }),
  };
});

import { Board } from "./Board";

const none: ReadonlySet<number> = new Set();
const board = emptyBoard(level);
const onToggleMark = vi.fn();
const onPlaceFace = vi.fn();
const view = (celebrate?: boolean) => (
  <Board
    celebrate={celebrate}
    level={level}
    board={board}
    wrong={none}
    conflicts={none}
    disabled={false}
    onToggleMark={onToggleMark}
    onPlaceFace={onPlaceFace}
  />
);
const fxCells = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("[data-fx]")).map((e) =>
    e.closest("button")?.getAttribute("data-index"),
  );

beforeEach(() => {
  fxStore.setState({ last: null, seq: 0 }, false);
  renders.byIndex.clear();
});

describe("Board fx", () => {
  test("only the outcome's cell gets the effect", () => {
    const { container } = render(view());
    act(() =>
      fxStore.getState().set({ kind: "place", cell: 5, faces: 1, hearts: 3 }),
    );
    expect(fxCells(container)).toEqual(["5"]);
  });

  test("a lose with a cell plays the wrong effect", () => {
    const { container } = render(view());
    act(() =>
      fxStore.getState().set({ kind: "lose", cell: 9, faces: 0, hearts: 0 }),
    );
    expect(container.querySelector("[data-fx]")?.getAttribute("data-fx")).toBe(
      "wrong",
    );
  });

  test("a win affects no cell", () => {
    const { container } = render(view());
    act(() => fxStore.getState().set({ kind: "win", faces: 7, hearts: 3 }));
    expect(fxCells(container)).toEqual([]);
  });

  test("clearing removes the effect", () => {
    const { container } = render(view());
    act(() =>
      fxStore.getState().set({ kind: "place", cell: 5, faces: 1, hearts: 3 }),
    );
    act(() => fxStore.getState().clear());
    expect(fxCells(container)).toEqual([]);
  });

  test("other cells do not re-render", () => {
    render(view());
    renders.byIndex.clear();
    act(() =>
      fxStore.getState().set({ kind: "place", cell: 5, faces: 1, hearts: 3 }),
    );
    expect([...renders.byIndex.keys()]).toEqual([5]);
    renders.byIndex.clear();
    act(() =>
      fxStore.getState().set({ kind: "wrong", cell: 8, faces: 1, hearts: 2 }),
    );
    expect([...renders.byIndex.keys()].sort()).toEqual([5, 8]);
  });

  test("celebrate sets data-celebrate on the grid and --row on each row", () => {
    const { container, rerender } = render(view());
    const grid = container.querySelector("[role=grid]");
    expect(grid).not.toHaveAttribute("data-celebrate");
    rerender(view(true));
    expect(grid).toHaveAttribute("data-celebrate");
    const rows = container.querySelectorAll<HTMLElement>("[role=row]");
    expect(rows).toHaveLength(level.size);
    rows.forEach((r, i) => {
      expect(r.style.getPropertyValue("--row")).toBe(String(i));
    });
  });

  test("toggling celebrate re-renders no cell", () => {
    const { rerender } = render(view());
    renders.byIndex.clear();
    rerender(view(true));
    expect(renders.byIndex.size).toBe(0);
  });
});
