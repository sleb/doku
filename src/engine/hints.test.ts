import { describe, expect, it } from "vitest";
import { withoutLookahead } from "./__fixtures__/capLadder";
import { fixtures, uniqueLevel7 } from "./__fixtures__/levels";
import {
  expertLevel1,
  hardLevel1,
  hardLevel2,
  mediumLevel11,
  rated,
} from "./__fixtures__/rated";
import { emptyBoard } from "./board";
import { type Hint, nextHint } from "./hints";
import { solveByTechniques } from "./solver";
import { Cell, type Level } from "./types";

// Only levels with a unique solution the ladder can finish.
const valid = fixtures.filter((f) => f.name.startsWith("unique"));
const solvable = [
  ...valid.map((f) => ({ name: f.name, level: f.level })),
  ...rated,
];

function applyHint(board: Uint8Array, hint: Hint) {
  const { deduction } = hint;
  if (deduction.place !== undefined) board[deduction.place] = Cell.Face;
  else for (const i of deduction.eliminate) board[i] = Cell.Mark;
}

describe("nextHint", () => {
  it("returns the simplest deduction with a message on an empty board", () => {
    const hint = nextHint(emptyBoard(uniqueLevel7), uniqueLevel7);
    const first = solveByTechniques(uniqueLevel7).steps[0];
    expect(hint?.deduction).toEqual(first);
    expect(hint?.message.length).toBeGreaterThan(0);
  });

  it("is null on a complete board", () => {
    const { size, solution } = uniqueLevel7;
    const board = emptyBoard(uniqueLevel7).slice();
    solution.forEach((c, r) => {
      board[r * size + c] = Cell.Face;
    });
    expect(nextHint(board, uniqueLevel7)).toBeNull();
  });

  it("is null when the ladder is stuck", () => {
    const stuck: Level = expertLevel1;
    const trace = withoutLookahead(() => solveByTechniques(stuck));
    expect(trace.solved).toBe(false);
    // Take every step the ladder can, as the player would, then ask again.
    const board = emptyBoard(stuck).slice();
    for (const step of trace.steps) {
      if (step.place !== undefined) board[step.place] = Cell.Face;
      else for (const i of step.eliminate) board[i] = Cell.Mark;
    }
    expect(withoutLookahead(() => nextHint(board, stuck))).toBeNull();
  });

  it("skips eliminations the player has already marked", () => {
    const trace = solveByTechniques(hardLevel1);
    const elimIdx = trace.steps.findIndex((s) => s.place === undefined);
    const step = trace.steps[elimIdx];
    const board = emptyBoard(hardLevel1).slice();
    // Replay everything before the elimination, as faces and marks.
    for (const s of trace.steps.slice(0, elimIdx)) {
      if (s.place !== undefined) board[s.place] = Cell.Face;
      else for (const i of s.eliminate) board[i] = Cell.Mark;
    }
    const before = nextHint(board, hardLevel1);
    expect(before?.deduction).toEqual(step);
    for (const i of step.eliminate) board[i] = Cell.Mark;
    const after = nextHint(board, hardLevel1);
    expect(after?.deduction).not.toEqual(step);
  });

  it.each(solvable)(
    "applying hints repeatedly never contradicts the solution in $name",
    ({ level }) => {
      const board = emptyBoard(level).slice();
      const inSolution = (c: number) =>
        level.solution[Math.floor(c / level.size)] === c % level.size;
      let done = false;
      for (let i = 0; i < level.size * level.size && !done; i++) {
        const hint = nextHint(board, level);
        if (!hint) {
          done = true;
          break;
        }
        const { place, eliminate } = hint.deduction;
        if (place !== undefined) expect(inSolution(place)).toBe(true);
        for (const c of eliminate) expect(inSolution(c)).toBe(false);
        applyHint(board, hint);
      }
      expect(done).toBe(true);
      expect(nextHint(board, level)).toBeNull();
      const faces = Array.from(board).filter((v) => v === Cell.Face).length;
      expect(faces).toBe(level.size);
    },
  );

  it("explains a hard deduction", () => {
    const board = emptyBoard(hardLevel2).slice();
    for (let i = 0; i < 49; i++) {
      const hint = nextHint(board, hardLevel2);
      if (!hint) break;
      if (hint.deduction.tier === "hard") {
        expect(hint.message).toMatch(/^[A-Z].*\.$/);
        return;
      }
      applyHint(board, hint);
    }
    throw new Error("no hard hint reached");
  });

  it("hints an 11x11 level in under 10 ms (median of warmed runs)", () => {
    const board = emptyBoard(mediumLevel11);
    for (let i = 0; i < 20; i++) nextHint(board, mediumLevel11);
    const times: number[] = [];
    for (let i = 0; i < 21; i++) {
      const start = performance.now();
      nextHint(board, mediumLevel11);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[10]).toBeLessThan(10);
  });
});
