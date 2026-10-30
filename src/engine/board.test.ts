import { describe, expect, expectTypeOf, it } from "vitest";
import { level7 } from "./__fixtures__/levels";
import { emptyBoard } from "./board";
import { Cell } from "./types";
import type { Board, Coord, Level, Tier } from "./index";

describe("emptyBoard", () => {
  it("creates an N×N board with every cell empty", () => {
    const board = emptyBoard(level7);
    expect(board.length).toBe(49);
    expect(Array.from(board).every((c) => c === Cell.Empty)).toBe(true);
  });

  it("is typed as a readonly board", () => {
    expectTypeOf(emptyBoard).returns.toEqualTypeOf<Board>();
    expectTypeOf<Board>().toEqualTypeOf<Readonly<Uint8Array>>();
    // @ts-expect-error a Board cannot be indexed for writing
    (emptyBoard(level7) as Board)[0] = Cell.Face;
  });
});

describe("types", () => {
  it("Level requires its core fields", () => {
    // @ts-expect-error solution is required
    const missing: Level = { id: "x", size: 7, regions: [] };
    expect(missing).toBeDefined();
    expectTypeOf<Level["tier"]>().toEqualTypeOf<Tier | undefined>();
    expectTypeOf<Coord>().toEqualTypeOf<{ r: number; c: number }>();
  });
});
