import { describe, expect, it } from "vitest";
import { level7, uniqueLevel7 } from "./__fixtures__/levels";
import { findConflicts, isSolved } from "./rules";
import { solve } from "./solver";
import { Cell, type Level } from "./types";

// Regions 0 and 1 are single cells at (0,0) and (1,1), which touch, so no
// placement can satisfy both.
const unsolvable: Level = {
  id: "unsolvable-7",
  size: 7,
  regions: [
    [0, 2, 2, 2, 2, 2, 2],
    [4, 1, 3, 3, 3, 3, 3],
    [4, 4, 4, 4, 4, 4, 4],
    [5, 5, 5, 5, 5, 5, 5],
    [5, 5, 5, 5, 5, 5, 5],
    [6, 6, 6, 6, 6, 6, 6],
    [6, 6, 6, 6, 6, 6, 6],
  ],
  solution: [0, 0, 0, 0, 0, 0, 0],
};

const toBoard = (level: Level, placement: number[]) => {
  const board = new Uint8Array(level.size * level.size);
  placement.forEach((c, r) => {
    board[r * level.size + c] = Cell.Face;
  });
  return board;
};

describe("solve", () => {
  it("finds the unique placement", () => {
    expect(solve(uniqueLevel7)).toEqual(uniqueLevel7.solution);
  });

  it("returns null when no placement exists", () => {
    expect(solve(unsolvable)).toBeNull();
  });

  it("ignores level.solution", () => {
    const wrong = { ...uniqueLevel7, solution: [0, 0, 0, 0, 0, 0, 0] };
    expect(solve(wrong)).toEqual(uniqueLevel7.solution);
  });

  it("returns a conflict-free placement for a multi-solution level", () => {
    const placement = solve(level7);
    expect(placement).toHaveLength(level7.size);
    const board = toBoard(level7, placement as number[]);
    expect(findConflicts(board, level7)).toEqual([]);
  });

  it("agrees with isSolved on the unique level", () => {
    const board = toBoard(uniqueLevel7, solve(uniqueLevel7) as number[]);
    expect(isSolved(board, uniqueLevel7)).toBe(true);
  });
});
