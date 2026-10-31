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
