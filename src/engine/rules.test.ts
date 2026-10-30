import { describe, expect, it } from "vitest";
import { level7 } from "./__fixtures__/levels";
import { emptyBoard } from "./board";
import { findConflicts } from "./rules";
import { type Board, Cell, type Coord, type Level } from "./types";

function boardWithFaces(level: Level, faces: Coord[]): Board {
  const board = emptyBoard(level) as Uint8Array;
  for (const { r, c } of faces) board[r * level.size + c] = Cell.Face;
  return board;
}

describe("findConflicts: rows and columns", () => {
  it("reports two faces sharing a row", () => {
    const board = boardWithFaces(level7, [
      { r: 2, c: 1 },
      { r: 2, c: 5 },
    ]);
    expect(findConflicts(board, level7)).toEqual([
      {
        reason: "row",
        cells: [
          { r: 2, c: 1 },
          { r: 2, c: 5 },
        ],
      },
    ]);
  });

  it("reports two faces sharing a column", () => {
    const board = boardWithFaces(level7, [
      { r: 0, c: 3 },
      { r: 4, c: 3 },
    ]);
    expect(findConflicts(board, level7)).toEqual([
      {
        reason: "col",
        cells: [
          { r: 0, c: 3 },
          { r: 4, c: 3 },
        ],
      },
    ]);
  });

  it("reports a row and a column conflict that share a cell", () => {
    const board = boardWithFaces(level7, [
      { r: 1, c: 1 },
      { r: 1, c: 4 },
      { r: 5, c: 1 },
    ]);
    expect(findConflicts(board, level7)).toEqual([
      {
        reason: "row",
        cells: [
          { r: 1, c: 1 },
          { r: 1, c: 4 },
        ],
      },
      {
        reason: "col",
        cells: [
          { r: 1, c: 1 },
          { r: 5, c: 1 },
        ],
      },
    ]);
  });

  it("reports three faces in one row as a single group", () => {
    const board = boardWithFaces(level7, [
      { r: 3, c: 0 },
      { r: 3, c: 2 },
      { r: 3, c: 6 },
    ]);
    expect(findConflicts(board, level7)).toEqual([
      {
        reason: "row",
        cells: [
          { r: 3, c: 0 },
          { r: 3, c: 2 },
          { r: 3, c: 6 },
        ],
      },
    ]);
  });

  it("returns no conflicts when no faces share a row or column", () => {
    const board = boardWithFaces(
      level7,
      level7.solution.map((c, r) => ({ r, c })),
    );
    expect(findConflicts(board, level7)).toEqual([]);
  });
});
