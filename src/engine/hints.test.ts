import { describe, expect, it } from "vitest";
import { fixtures, uniqueLevel7 } from "./__fixtures__/levels";
import { emptyBoard } from "./board";
import { nextHint } from "./hints";
import { isSolved, judgeTap } from "./rules";
import { Cell } from "./types";

const valid = fixtures.filter((f) => f.name !== "noSolutionLevel7");

describe("nextHint", () => {
  it("is the solution cell of the first row on an empty board", () => {
    const { size, solution } = uniqueLevel7;
    expect(nextHint(emptyBoard(uniqueLevel7), uniqueLevel7)).toBe(solution[0]);
    expect(size).toBe(7);
  });

  it("skips rows that already hold a face", () => {
    const { size, solution } = uniqueLevel7;
    const board = emptyBoard(uniqueLevel7).slice();
    board[solution[0]] = Cell.Face;
    board[size + ((solution[1] + 1) % size)] = Cell.Mark;
    expect(nextHint(board, uniqueLevel7)).toBe(size + solution[1]);
  });

  it("targets the first faceless row even if later rows have faces", () => {
    const { size, solution } = uniqueLevel7;
    const board = emptyBoard(uniqueLevel7).slice();
    board[size + solution[1]] = Cell.Face;
    expect(nextHint(board, uniqueLevel7)).toBe(solution[0]);
  });

  it("is null on a complete board", () => {
    const { size, solution } = uniqueLevel7;
    const board = emptyBoard(uniqueLevel7).slice();
    solution.forEach((c, r) => {
      board[r * size + c] = Cell.Face;
    });
    expect(nextHint(board, uniqueLevel7)).toBeNull();
  });

  it.each(valid)(
    "repeated hints solve $name, each judged correct",
    ({ level }) => {
      const board = emptyBoard(level).slice();
      for (let i = 0; i < level.size; i++) {
        const cell = nextHint(board, level);
        if (cell === null) throw new Error("expected a hint");
        expect(judgeTap(level, cell)).toBe("correct");
        board[cell] = Cell.Face;
      }
      expect(nextHint(board, level)).toBeNull();
      expect(isSolved(board, level)).toBe(true);
    },
  );
});
