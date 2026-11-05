import { describe, expect, test } from "vitest";
import {
  Cell,
  countSolutions,
  findConflicts,
  isSolved,
  nextHint,
} from "../engine";
import { LEVELS } from "../levels/campaign";
import { STEPS } from "./steps";

const solutionCells = (s: (typeof STEPS)[number]) =>
  s.level.solution.map((c, r) => r * s.level.size + c);

describe("tutorial steps", () => {
  test("there are six steps", () => {
    expect(STEPS).toHaveLength(6);
  });

  test("ids are unique, tutorial-N, and never campaign levels", () => {
    const ids = STEPS.map((s) => s.level.id);
    expect(new Set(ids).size).toBe(STEPS.length);
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
    ids.forEach((id, i) => {
      expect(id).toBe(`tutorial-${i + 1}`);
      expect(LEVELS.some((l) => l.id === id)).toBe(false);
    });
  });

  test("boards are 4x4 to 6x6 with exactly one solution", () => {
    for (const s of STEPS) {
      expect(s.level.size).toBeGreaterThanOrEqual(4);
      expect(s.level.size).toBeLessThanOrEqual(6);
      expect(countSolutions(s.level)).toBe(1);
    }
  });

  test("the start board is sized to the level, has only faces from the solution and no conflicts", () => {
    for (const s of STEPS) {
      const n = s.level.size;
      expect(s.start).toHaveLength(n * n);
      const sol = solutionCells(s);
      s.start.forEach((c, i) => {
        if (c !== Cell.Empty) {
          expect(c).toBe(Cell.Face);
          expect(sol).toContain(i);
        }
      });
      expect(findConflicts(s.start, s.level)).toEqual([]);
    }
  });

  test("goals agree with the solution and the start board", () => {
    for (const s of STEPS) {
      const sol = solutionCells(s);
      expect(s.goal.length).toBeGreaterThan(0);
      for (const g of s.goal) {
        expect(g.cell).toBeGreaterThanOrEqual(0);
        expect(g.cell).toBeLessThan(s.level.size ** 2);
        expect(s.start[g.cell]).toBe(Cell.Empty);
        if (g.kind === "face") expect(sol).toContain(g.cell);
        else expect(sol).not.toContain(g.cell);
      }
    }
  });

  test("the hint step's goal is the cell the hint places", () => {
    const step = STEPS.find((s) => s.controls?.includes("hint"));
    if (!step) throw new Error("no hint step");
    expect(step.goal).toEqual([
      { cell: nextHint(step.start, step.level), kind: "face" },
    ]);
  });

  test("the hearts step has a wrong goal and shows hearts", () => {
    const step = STEPS.filter((s) => s.goal.some((g) => g.kind === "wrong"));
    expect(step).toHaveLength(1);
    expect(step[0].showHearts).toBe(true);
  });

  test("no step's goal completes the board, so the store never reports a win", () => {
    for (const s of STEPS) {
      const board = s.start.slice();
      for (const g of s.goal) if (g.kind === "face") board[g.cell] = Cell.Face;
      expect(isSolved(board, s.level), s.id).toBe(false);
    }
  });

  test("controls are cumulative: undo and redo from the notes step on, hint only at the end", () => {
    const has = (c: "undo" | "redo" | "hint") =>
      STEPS.filter((s) => s.controls?.includes(c)).map((s) => s.id);
    expect(has("undo")).toEqual(["notes", "hearts", "hint"]);
    expect(has("redo")).toEqual(["notes", "hearts", "hint"]);
    expect(has("hint")).toEqual(["hint"]);
  });

  test("every step has copy, a gesture per input mode and highlights in range", () => {
    for (const s of STEPS) {
      for (const t of [s.title, s.body, s.how.mark, s.how.face, s.onWrong])
        expect(t.trim().length).toBeGreaterThan(0);
      expect(s.highlight.length).toBeGreaterThan(0);
      for (const h of s.highlight) expect(h).toBeLessThan(s.level.size ** 2);
    }
  });
});
