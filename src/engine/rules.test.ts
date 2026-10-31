import { describe, expect, it } from "vitest";
import { multiSolutionLevel7 } from "./__fixtures__/levels";
import { emptyBoard } from "./board";
import { findConflicts, isSolved } from "./rules";
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
  ...multiSolutionLevel7,
  regions: multiSolutionLevel7.regions.map((row, r) =>
    row.map((_, c) => (r + c) % 7),
  ),
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

// Test-only: reassigns cells of multiSolutionLevel7 to region 0, which leaves region 0
// disconnected. Fine for findConflicts, but never pass it to loadLevel.
function levelWithSharedRegion(cells: Coord[]): Level {
  const regions = multiSolutionLevel7.regions.map((row) => [...row]);
  for (const { r, c } of cells) regions[r][c] = 0;
  return { ...multiSolutionLevel7, regions };
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
    // (3,4) and (4,3) both sit in region 0 of latinLevel.
    const cells = [
      { r: 3, c: 4 },
      { r: 4, c: 3 },
    ];
    expect(findConflicts(board, latinLevel)).toEqual([
      { reason: "region", cells },
      pair(cells[0], cells[1]),
    ]);
  });

  it("does not wrap from the left edge to the end of the next row", () => {
    const board = boardWithFaces(latinLevel, [
      { r: 3, c: 0 },
      { r: 3, c: 6 },
    ]);
    expect(
      findConflicts(board, latinLevel).filter((x) => x.reason === "adjacent"),
    ).toEqual([]);
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

describe("findConflicts: marks and clean boards", () => {
  function markAll(level: Level, cells: Coord[], board?: Board): Board {
    const b = (board ?? emptyBoard(level)) as Uint8Array;
    for (const { r, c } of cells) b[r * level.size + c] = Cell.Mark;
    return b;
  }
  const range = (level: Level) =>
    Array.from({ length: level.size }, (_, i) => i);
  const everyCell = (level: Level) =>
    range(level).flatMap((r) => range(level).map((c) => ({ r, c })));

  it("ignores marks filling a row, a column and a region", () => {
    // latinLevel regions are diagonals, so region 5 is neither a row nor a column.
    const level = latinLevel;
    const row = range(level).map((c) => ({ r: 2, c }));
    const col = range(level).map((r) => ({ r, c: 4 }));
    const region = everyCell(level).filter(
      ({ r, c }) => level.regions[r][c] === 5,
    );
    const extras = [
      { r: 0, c: 0 },
      { r: 0, c: 1 },
      { r: 6, c: 6 },
    ];
    const board = markAll(level, [...row, ...col, ...region, ...extras]);
    expect(findConflicts(board, level)).toEqual([]);
  });

  it("returns no conflicts when every cell is a mark", () => {
    expect(
      findConflicts(
        markAll(multiSolutionLevel7, everyCell(multiSolutionLevel7)),
        multiSolutionLevel7,
      ),
    ).toEqual([]);
  });

  it("returns no conflicts for an empty board", () => {
    expect(
      findConflicts(emptyBoard(multiSolutionLevel7), multiSolutionLevel7),
    ).toEqual([]);
  });

  it("returns no conflicts for the full solution with marks elsewhere", () => {
    const faces = multiSolutionLevel7.solution.map((c, r) => ({ r, c }));
    const board = boardWithFaces(multiSolutionLevel7, faces);
    const others = everyCell(multiSolutionLevel7).filter(
      ({ r, c }) => multiSolutionLevel7.solution[r] !== c,
    );
    expect(
      findConflicts(
        markAll(multiSolutionLevel7, others, board),
        multiSolutionLevel7,
      ),
    ).toEqual([]);
  });

  it("neither masks nor adds conflicts when marks surround conflicting faces", () => {
    const faces = [
      { r: 3, c: 0 },
      { r: 3, c: 3 },
    ];
    const board = boardWithFaces(latinLevel, faces);
    const others = everyCell(latinLevel).filter(
      ({ r, c }) => !(r === 3 && (c === 0 || c === 3)),
    );
    expect(
      findConflicts(markAll(latinLevel, others, board), latinLevel),
    ).toEqual([{ reason: "row", cells: faces }]);
  });
});

describe("isSolved", () => {
  const solution: Coord[] = multiSolutionLevel7.solution.map((c, r) => ({
    r,
    c,
  }));

  it("is true for exactly the solution", () => {
    expect(
      isSolved(
        boardWithFaces(multiSolutionLevel7, solution),
        multiSolutionLevel7,
      ),
    ).toBe(true);
  });

  it("is false one face short", () => {
    expect(
      isSolved(
        boardWithFaces(multiSolutionLevel7, solution.slice(1)),
        multiSolutionLevel7,
      ),
    ).toBe(false);
  });

  it("is false with N faces where two share a row", () => {
    const board = boardWithFaces(multiSolutionLevel7, [
      ...solution.slice(0, 6),
      { r: 5, c: (multiSolutionLevel7.solution[5] + 2) % 7 },
    ]);
    expect(isSolved(board, multiSolutionLevel7)).toBe(false);
  });

  it("is false with N faces in N distinct rows but off the solution", () => {
    const shifted = multiSolutionLevel7.solution.map((c, r) => ({
      r,
      c: (c + 1) % 7,
    }));
    expect(
      isSolved(
        boardWithFaces(multiSolutionLevel7, shifted),
        multiSolutionLevel7,
      ),
    ).toBe(false);
  });

  it("ignores marks", () => {
    const board = boardWithFaces(multiSolutionLevel7, solution);
    const spare = [0, 1, 2, 3, 4, 5, 6].find(
      (c) => c !== multiSolutionLevel7.solution[0],
    );
    (board as Uint8Array)[spare as number] = Cell.Mark;
    expect(isSolved(board, multiSolutionLevel7)).toBe(true);
  });

  it("is false with an extra face", () => {
    const spare = [0, 1, 2, 3, 4, 5, 6].find(
      (c) => c !== multiSolutionLevel7.solution[0],
    );
    const board = boardWithFaces(multiSolutionLevel7, [
      ...solution,
      { r: 0, c: spare as number },
    ]);
    expect(isSolved(board, multiSolutionLevel7)).toBe(false);
  });

  it("is false for an empty board", () => {
    expect(isSolved(emptyBoard(multiSolutionLevel7), multiSolutionLevel7)).toBe(
      false,
    );
  });
});
