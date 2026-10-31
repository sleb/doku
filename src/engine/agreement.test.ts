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

    it("places exactly one face per row", () => {
      expect(board.filter((v) => v === Cell.Face)).toHaveLength(level.size);
    });

    it("isSolved holds when the placement is the stored solution", () => {
      // isSolved compares against level.solution, so for a multi-solution
      // level it only applies if solve() happened to return that one.
      const isStored = placement.join() === level.solution.join();
      if (countSolutions(level) === 1) expect(isStored).toBe(true);
      expect(isSolved(board, level)).toBe(isStored);
    });

    it("a shifted face is caught", () => {
      const shifted = [...placement];
      shifted[0] = (shifted[0] + 1) % level.size;
      const bad = boardFrom(level, shifted);
      const caught =
        findConflicts(bad, level).length > 0 || !isSolved(bad, level);
      expect(caught).toBe(true);
    });

    it("a duplicated face is caught", () => {
      const dup = [...placement];
      dup[1] = dup[0];
      const bad = boardFrom(level, dup);
      expect(findConflicts(bad, level).length).toBeGreaterThan(0);
      expect(isSolved(bad, level)).toBe(false);
    });
  });
});
