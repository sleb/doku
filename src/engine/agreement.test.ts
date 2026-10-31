import { describe, expect, it } from "vitest";
import { fixtures, noSolutionLevel7 } from "./__fixtures__/levels";
import { findConflicts, isSolved } from "./rules";
import { countSolutions, solve } from "./solver";
import { Cell, type Level } from "./types";

// Local helper on purpose: no production setCell, no shared test imports.
const boardFrom = (level: Level, placement: number[]) => {
  const board = new Uint8Array(level.size * level.size);
  placement.forEach((c, r) => {
    board[r * level.size + c] = Cell.Face;
  });
  return board;
};

const solvable = fixtures
  .map(({ name, level }) => ({ name, level, placement: solve(level) }))
  .filter(
    (f): f is { name: string; level: Level; placement: number[] } =>
      f.placement !== null,
  );

describe("solver and rules agree", () => {
  it("has enough solvable fixtures to be meaningful", () => {
    expect(solvable.length).toBeGreaterThanOrEqual(3);
  });

  it("guards: the no-solution fixture is not solvable", () => {
    expect(solve(noSolutionLevel7)).toBeNull();
  });

  describe.each(solvable)("$name", ({ level, placement }) => {
    const board = boardFrom(level, placement);

    it("solve() output has no conflicts", () => {
      expect(findConflicts(board, level)).toEqual([]);
    });

    it("solve() output is one in-range column per row", () => {
      expect(placement).toHaveLength(level.size);
      for (const c of placement) {
        expect(Number.isInteger(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(level.size);
      }
    });

    it("isSolved holds for a unique level's solve() output", () => {
      // isSolved is defined against the stored solution, so it is only
      // implied for multi-solution levels if solve() happened to return that
      // one. Assert it only where the solution is unique.
      if (countSolutions(level) === 1)
        expect(isSolved(board, level)).toBe(true);
    });

    it("a shifted face is not solved", () => {
      const shifted = [...placement];
      shifted[0] = (shifted[0] + 1) % level.size;
      expect(isSolved(boardFrom(level, shifted), level)).toBe(false);
    });

    it("a duplicated column is reported as a column conflict", () => {
      const dup = [...placement];
      dup[1] = dup[0];
      const bad = boardFrom(level, dup);
      const reasons = findConflicts(bad, level).map((c) => c.reason);
      expect(reasons).toContain("col");
      expect(isSolved(bad, level)).toBe(false);
    });
  });
});
