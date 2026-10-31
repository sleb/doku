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

// Test-only: regions form a Latin square, so no row or column repeats a region
// and row/col conflicts are never accompanied by region conflicts. The regions
// are disconnected; never pass this to loadLevel.
const latinLevel: Level = {
  ...level7,
  regions: level7.regions.map((row, r) => row.map((_, c) => (r + c) % 7)),
};

describe("findConflicts: rows and columns", () => {
  it("reports two faces sharing a row", () => {
    const board = boardWithFaces(latinLevel, [
      { r: 2, c: 1 },
      { r: 2, c: 5 },
    ]);
    expect(findConflicts(board, latinLevel)).toEqual([
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
    const board = boardWithFaces(latinLevel, [
      { r: 0, c: 3 },
      { r: 4, c: 3 },
    ]);
    expect(findConflicts(board, latinLevel)).toEqual([
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
    const board = boardWithFaces(latinLevel, [
      { r: 1, c: 1 },
      { r: 1, c: 4 },
      { r: 5, c: 1 },
    ]);
    expect(findConflicts(board, latinLevel)).toEqual([
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
    const board = boardWithFaces(latinLevel, [
      { r: 3, c: 0 },
      { r: 3, c: 2 },
      { r: 3, c: 6 },
    ]);
    expect(findConflicts(board, latinLevel)).toEqual([
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
      latinLevel,
      latinLevel.solution.map((c, r) => ({ r, c })),
    );
    expect(findConflicts(board, latinLevel)).toEqual([]);
  });
});

// Test-only: reassigns cells of level7 to region 0, which leaves region 0
// disconnected. Fine for findConflicts, but never pass it to loadLevel.
function levelWithSharedRegion(cells: Coord[]): Level {
  const regions = level7.regions.map((row) => [...row]);
  for (const { r, c } of cells) regions[r][c] = 0;
  return { ...level7, regions };
}

describe("findConflicts: regions", () => {
  const level = levelWithSharedRegion([
    { r: 4, c: 4 },
    { r: 2, c: 6 },
  ]);

  it("reports two faces in one region that share no row or column", () => {
    const board = boardWithFaces(level, [
      { r: 0, c: 0 },
      { r: 4, c: 4 },
    ]);
    expect(findConflicts(board, level)).toEqual([
      {
        reason: "region",
        cells: [
          { r: 0, c: 0 },
          { r: 4, c: 4 },
        ],
      },
    ]);
  });

  it("reports three faces in one region as a single group", () => {
    const board = boardWithFaces(level, [
      { r: 0, c: 0 },
      { r: 2, c: 6 },
      { r: 4, c: 4 },
    ]);
    expect(findConflicts(board, level)).toEqual([
      {
        reason: "region",
        cells: [
          { r: 0, c: 0 },
          { r: 2, c: 6 },
          { r: 4, c: 4 },
        ],
      },
    ]);
  });

  it("does not report faces in different regions", () => {
    const board = boardWithFaces(level, [
      { r: 0, c: 0 },
      { r: 3, c: 4 },
    ]);
    expect(findConflicts(board, level)).toEqual([]);
  });
});

describe("findConflicts: adjacency", () => {
  const pair = (a: Coord, b: Coord) => ({
    reason: "adjacent" as const,
    cells: [a, b],
  });

  it("reports a diagonal pair", () => {
    const board = boardWithFaces(latinLevel, [
      { r: 3, c: 3 },
      { r: 4, c: 4 },
    ]);
    expect(findConflicts(board, latinLevel)).toEqual([
      pair({ r: 3, c: 3 }, { r: 4, c: 4 }),
    ]);
  });

  it("reports an anti-diagonal pair with cells ascending", () => {
    const board = boardWithFaces(latinLevel, [
      { r: 4, c: 3 },
      { r: 3, c: 4 },
    ]);
    const adjacent = findConflicts(board, latinLevel).filter(
      (x) => x.reason === "adjacent",
    );
    expect(adjacent).toEqual([pair({ r: 3, c: 4 }, { r: 4, c: 3 })]);
  });

  it("reports a vertical pair as column and adjacent", () => {
    const board = boardWithFaces(latinLevel, [
      { r: 3, c: 3 },
      { r: 4, c: 3 },
    ]);
    expect(findConflicts(board, latinLevel)).toEqual([
      {
        reason: "col",
        cells: [
          { r: 3, c: 3 },
          { r: 4, c: 3 },
        ],
      },
      pair({ r: 3, c: 3 }, { r: 4, c: 3 }),
    ]);
  });

  it("does not flag a knight's move", () => {
    const board = boardWithFaces(latinLevel, [
      { r: 3, c: 3 },
      { r: 5, c: 4 },
    ]);
    expect(findConflicts(board, latinLevel)).toEqual([]);
  });

  it("reports row, region and adjacent for a horizontal pair in one region", () => {
    const level = levelWithSharedRegion([
      { r: 3, c: 3 },
      { r: 3, c: 4 },
    ]);
    const cells = [
      { r: 3, c: 3 },
      { r: 3, c: 4 },
    ];
    const board = boardWithFaces(level, cells);
    expect(findConflicts(board, level)).toEqual([
      { reason: "row", cells },
      { reason: "region", cells },
      { reason: "adjacent", cells },
    ]);
  });

  it("reports each touching pair in a diagonal chain", () => {
    const board = boardWithFaces(latinLevel, [
      { r: 2, c: 2 },
      { r: 3, c: 3 },
      { r: 4, c: 4 },
    ]);
    expect(findConflicts(board, latinLevel)).toEqual([
      pair({ r: 2, c: 2 }, { r: 3, c: 3 }),
      pair({ r: 3, c: 3 }, { r: 4, c: 4 }),
    ]);
  });

  it("ignores marks beside a face", () => {
    const board = boardWithFaces(latinLevel, [{ r: 3, c: 3 }]) as Uint8Array;
    board[3 * latinLevel.size + 4] = Cell.Mark;
    board[4 * latinLevel.size + 4] = Cell.Mark;
    expect(findConflicts(board, latinLevel)).toEqual([]);
  });

  it("handles faces in the corners without leaving the board", () => {
    const board = boardWithFaces(latinLevel, [
      { r: 0, c: 0 },
      { r: 1, c: 1 },
      { r: 6, c: 6 },
      { r: 5, c: 5 },
    ]);
    expect(findConflicts(board, latinLevel)).toEqual([
      pair({ r: 0, c: 0 }, { r: 1, c: 1 }),
      pair({ r: 5, c: 5 }, { r: 6, c: 6 }),
    ]);
  });
});
