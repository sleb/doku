import { describe, expect, it } from "vitest";
import {
  multiSolutionLevel7,
  noSolutionLevel7,
  uniqueLevel7,
} from "./__fixtures__/levels";
import * as engine from "./index";
import { findConflicts, isSolved } from "./rules";
import { countSolutions, solve } from "./solver";
import { Cell, type Level } from "./types";

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
    expect(solve(noSolutionLevel7)).toBeNull();
  });

  it("ignores level.solution", () => {
    const wrong = { ...uniqueLevel7, solution: [0, 0, 0, 0, 0, 0, 0] };
    expect(solve(wrong)).toEqual(uniqueLevel7.solution);
  });

  it("returns a conflict-free placement for a multi-solution level", () => {
    const placement = solve(multiSolutionLevel7);
    expect(placement).toHaveLength(multiSolutionLevel7.size);
    const board = toBoard(multiSolutionLevel7, placement as number[]);
    expect(findConflicts(board, multiSolutionLevel7)).toEqual([]);
  });

  it("agrees with isSolved on the unique level", () => {
    const board = toBoard(uniqueLevel7, solve(uniqueLevel7) as number[]);
    expect(isSolved(board, uniqueLevel7)).toBe(true);
  });
});

describe("countSolutions", () => {
  it("counts 1 for a unique level", () => {
    expect(countSolutions(uniqueLevel7, 2)).toBe(1);
  });

  it("defaults the limit to 2", () => {
    expect(countSolutions(multiSolutionLevel7)).toBe(2);
    expect(countSolutions(uniqueLevel7)).toBe(1);
  });

  it("stops at the limit for an ambiguous level", () => {
    expect(countSolutions(multiSolutionLevel7, 2)).toBe(2);
    expect(countSolutions(multiSolutionLevel7, 1)).toBe(1);
  });

  it("counts every solution when unbounded, proving the early stop", () => {
    expect(
      countSolutions(multiSolutionLevel7, Number.POSITIVE_INFINITY),
    ).toBeGreaterThan(2);
  });

  it("returns 0 for an noSolutionLevel7 level", () => {
    expect(countSolutions(noSolutionLevel7, 2)).toBe(0);
  });

  it("returns 0 for a non-positive limit", () => {
    expect(countSolutions(uniqueLevel7, 0)).toBe(0);
    expect(countSolutions(uniqueLevel7, -1)).toBe(0);
  });

  it("is exported from the engine barrel", () => {
    expect(engine.countSolutions).toBe(countSolutions);
  });
});

// Independent oracle: enumerate every column assignment with cheap pruning.
const bruteForceCount = (level: Level): number => {
  const { size: n, regions } = level;
  const cols: number[] = [];
  let count = 0;
  const go = (r: number) => {
    if (r === n) {
      count++;
      return;
    }
    for (let c = 0; c < n; c++) {
      if (cols.includes(c)) continue;
      if (r > 0 && Math.abs(c - cols[r - 1]) < 2) continue;
      if (cols.some((pc, pr) => regions[pr][pc] === regions[r][c])) continue;
      cols.push(c);
      go(r + 1);
      cols.pop();
    }
  };
  go(0);
  return count;
};

describe("countSolutions vs brute force", () => {
  it("finds exactly one solution for the unique fixture", () => {
    expect(bruteForceCount(uniqueLevel7)).toBe(1);
  });

  it("matches the unbounded count on the ambiguous fixture", () => {
    expect(countSolutions(multiSolutionLevel7, Number.POSITIVE_INFINITY)).toBe(
      bruteForceCount(multiSolutionLevel7),
    );
  });
});
