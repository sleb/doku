import { describe, expect, test } from "vitest";
import { Cell, emptyBoard } from "../engine";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { placeFace, startLevel, toggleMark } from "./game";
import { conflictCells } from "./selectors";

const level = uniqueLevel7;
const n = level.size;

function withFaces(cells: number[]) {
  const board = emptyBoard(level) as Uint8Array;
  for (const i of cells) board[i] = Cell.Face;
  return board;
}

describe("conflictCells", () => {
  test("flags an adjacent pair", () => {
    // (0,0) and (1,1) touch diagonally.
    const got = conflictCells(withFaces([0, n + 1]), level);
    expect([...got].sort((a, b) => a - b)).toEqual([0, n + 1]);
  });

  test("flags a same-row pair", () => {
    const got = conflictCells(withFaces([0, 4]), level);
    expect(got.has(0)).toBe(true);
    expect(got.has(4)).toBe(true);
  });

  test("is empty for a solution-consistent board", () => {
    expect(conflictCells(withFaces([1]), level).size).toBe(0);
  });

  test("is empty after real play with correct and wrong taps", () => {
    let s = startLevel(level);
    s = toggleMark(s, 0);
    s = placeFace(s, 0 * n + level.solution[0]); // correct
    s = placeFace(s, 1 * n + 0); // wrong
    s = placeFace(s, 2 * n + level.solution[2]); // correct
    if (s.status === "idle") throw new Error("unreachable");
    expect(conflictCells(s.board, level).size).toBe(0);
  });
});
