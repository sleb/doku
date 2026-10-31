import { describe, expect, it } from "vitest";
import { Cell } from "../engine";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { idleState, MAX_HEARTS, restart, startLevel } from "./game";

describe("startLevel", () => {
  it("starts a playing game with full hearts and an empty board", () => {
    const state = startLevel(uniqueLevel7);
    if (state.status === "idle") throw new Error("expected a started level");
    expect(state.status).toBe("playing");
    expect(state.hearts).toBe(MAX_HEARTS);
    expect(MAX_HEARTS).toBe(3);
    expect(state.board).toHaveLength(49);
    expect(state.board.every((c) => c === Cell.Empty)).toBe(true);
    expect(state.level).toBe(uniqueLevel7);
    expect(state.wrong.size).toBe(0);
  });
});

describe("idleState", () => {
  it("has no level or board", () => {
    expect(idleState).toEqual({
      status: "idle",
      level: null,
      board: null,
      hearts: MAX_HEARTS,
    });
  });
});

describe("restart", () => {
  for (const status of ["won", "lost"] as const) {
    it(`resets a ${status} game`, () => {
      const started = startLevel(uniqueLevel7);
      if (started.status === "idle") throw new Error("unreachable");
      const board = started.board.slice();
      board[0] = Cell.Face;
      board[1] = Cell.Mark;
      const done = {
        ...started,
        status,
        board,
        hearts: 0,
        wrong: new Set([1]),
      };
      const next = restart(done);
      if (next.status === "idle") throw new Error("expected started");
      expect(next.status).toBe("playing");
      expect(next.hearts).toBe(MAX_HEARTS);
      expect(next.board.every((c) => c === Cell.Empty)).toBe(true);
      expect(next.wrong.size).toBe(0);
    });
  }

  it("returns the same idle state", () => {
    expect(restart(idleState)).toBe(idleState);
  });
});
