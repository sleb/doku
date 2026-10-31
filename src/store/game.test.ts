import { describe, expect, it } from "vitest";
import { Cell } from "../engine";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import {
  type GameState,
  idleState,
  MAX_HEARTS,
  restart,
  startLevel,
  toggleMark,
} from "./game";

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

describe("toggleMark", () => {
  function started(): Exclude<GameState, { status: "idle" }> {
    const s = startLevel(uniqueLevel7);
    if (s.status === "idle") throw new Error("unreachable");
    return s;
  }

  it("toggles Empty -> Mark -> Empty without touching hearts or wrong", () => {
    const s0 = started();
    const s1 = toggleMark(s0, 0);
    if (s1.status === "idle") throw new Error("unreachable");
    expect(s1.board[0]).toBe(Cell.Mark);
    expect(s1.board.slice(1).every((c) => c === Cell.Empty)).toBe(true);
    expect(s1.hearts).toBe(MAX_HEARTS);
    expect(s1.wrong).toBe(s0.wrong);
    expect(s1.status).toBe("playing");
    const s2 = toggleMark(s1, 0);
    if (s2.status === "idle") throw new Error("unreachable");
    expect(s2.board[0]).toBe(Cell.Empty);
    expect(s2.hearts).toBe(MAX_HEARTS);
    expect(s2.wrong.size).toBe(0);
  });

  it("allows a note on a solution cell with no heart lost", () => {
    const s1 = toggleMark(started(), 1);
    if (s1.status === "idle") throw new Error("unreachable");
    expect(s1.board[1]).toBe(Cell.Mark);
    expect(s1.hearts).toBe(MAX_HEARTS);
    expect(s1.wrong.size).toBe(0);
  });

  it("ignores a Face cell", () => {
    const s = started();
    const board = s.board.slice();
    board[2] = Cell.Face;
    const state = { ...s, board };
    expect(toggleMark(state, 2)).toBe(state);
  });

  it("ignores a locked wrong Mark", () => {
    const s = started();
    const board = s.board.slice();
    board[3] = Cell.Mark;
    const state = { ...s, board, wrong: new Set([3]) };
    expect(toggleMark(state, 3)).toBe(state);
  });

  it("ignores won, lost and idle states", () => {
    for (const status of ["won", "lost"] as const) {
      const state = { ...started(), status };
      expect(toggleMark(state, 0)).toBe(state);
    }
    expect(toggleMark(idleState, 0)).toBe(idleState);
  });

  it("throws RangeError for a bad index while playing", () => {
    const s = started();
    for (const bad of [-1, 49, 1.5, Number.NaN]) {
      expect(() => toggleMark(s, bad)).toThrow(RangeError);
    }
  });

  it("checks status before the index", () => {
    const state = { ...started(), status: "won" as const };
    expect(toggleMark(state, 999)).toBe(state);
  });

  it("does not mutate the previous state", () => {
    const s = started();
    const snapshot = s.board.slice();
    Object.freeze(s);
    const next = toggleMark(s, 0);
    if (next.status === "idle") throw new Error("unreachable");
    expect(s.board).toEqual(snapshot);
    expect(next.board).not.toBe(s.board);
  });
});
