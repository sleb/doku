import { describe, expect, it } from "vitest";
import {
  fixtures,
  multiSolutionLevel7,
  noSolutionLevel7,
  uniqueLevel7,
  uniqueLevel11,
} from "./__fixtures__/levels";
import { isSolved } from "./rules";
import { countSolutions, solve } from "./solver";
import { Cell, type Level } from "./types";
import { validateLevel } from "./validate";

const solvedBoard = (level: Level) => {
  const board = new Uint8Array(level.size * level.size);
  level.solution.forEach((c, r) => {
    board[r * level.size + c] = Cell.Face;
  });
  return board;
};

// Test-only brute force: one face per row, column and region, adjacency ignored.
const countWithoutAdjacency = (level: Level): number => {
  const n = level.size;
  const walk = (r: number, cols: Set<number>, regs: Set<number>): number => {
    if (r === n) return 1;
    let total = 0;
    for (let c = 0; c < n; c++) {
      const reg = level.regions[r][c];
      if (cols.has(c) || regs.has(reg)) continue;
      total += walk(r + 1, new Set(cols).add(c), new Set(regs).add(reg));
    }
    return total;
  };
  return walk(0, new Set(), new Set());
};

describe.each([
  ["uniqueLevel7", uniqueLevel7, 7],
  ["uniqueLevel11", uniqueLevel11, 11],
])("%s", (_name, level, size) => {
  it("has the documented size", () => {
    expect(level.size).toBe(size);
  });

  it("is a valid level", () => {
    expect(validateLevel(level)).toEqual([]);
  });

  it("has exactly one solution, equal to level.solution", () => {
    expect(countSolutions(level, 2)).toBe(1);
    expect(solve(level)).toEqual(level.solution);
  });

  it("is solved by its stored solution", () => {
    expect(isSolved(solvedBoard(level), level)).toBe(true);
  });
});

describe("multiSolutionLevel7", () => {
  it("is valid but has more than one solution", () => {
    expect(validateLevel(multiSolutionLevel7)).toEqual([]);
    expect(countSolutions(multiSolutionLevel7, 2)).toBe(2);
  });
});

describe("noSolutionLevel7", () => {
  it("has no solution", () => {
    expect(countSolutions(noSolutionLevel7)).toBe(0);
    expect(solve(noSolutionLevel7)).toBeNull();
  });

  it("has well-formed regions; only its dummy solution is invalid", () => {
    const issues = validateLevel(noSolutionLevel7);
    expect(issues.length).toBeGreaterThan(0);
    const solutionRules = ["col", "region", "adjacent"];
    expect(issues.filter((i) => !solutionRules.includes(i.rule))).toEqual([]);
  });

  it("has 5 placements once the adjacency rule is removed", () => {
    expect(countWithoutAdjacency(noSolutionLevel7)).toBe(5);
  });
});

describe("fixtures", () => {
  it("documents a purpose for every fixture", () => {
    expect(fixtures.length).toBeGreaterThan(0);
    for (const { purpose } of fixtures) {
      expect(purpose.trim()).not.toBe("");
    }
  });

  it("lists every fixture level", () => {
    expect(fixtures.map((f) => f.level)).toEqual([
      uniqueLevel7,
      uniqueLevel11,
      multiSolutionLevel7,
      noSolutionLevel7,
    ]);
  });
});
