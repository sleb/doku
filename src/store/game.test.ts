import { describe, expect, it } from "vitest";
import { Cell, isSolved, type Level } from "../engine";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import {
  type GameState,
  idleState,
  MAX_HEARTS,
  placeFace,
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
    expect(state.board).toHaveLength(uniqueLevel7.size ** 2);
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
    for (const bad of [-1, uniqueLevel7.size ** 2, 1.5, Number.NaN]) {
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

describe("placeFace", () => {
  type Started = Exclude<GameState, { status: "idle" }>;
  const solutionCells = (level: Level) =>
    level.solution.map((c, r) => r * level.size + c);
  const wrongCellsFor = (level: Level) => {
    const sol = new Set(solutionCells(level));
    return Array.from({ length: level.size ** 2 }, (_, i) => i).filter(
      (i) => !sol.has(i),
    );
  };
  const wrongCellFor = (level: Level) => wrongCellsFor(level)[0];
  function started(): Started {
    const s = startLevel(uniqueLevel7);
    if (s.status === "idle") throw new Error("unreachable");
    return s;
  }
  function live(s: GameState): Started {
    if (s.status === "idle") throw new Error("unreachable");
    return s;
  }
  const sol = solutionCells(uniqueLevel7);
  const bad = wrongCellsFor(uniqueLevel7);

  it("places a face on a correct empty cell", () => {
    const s0 = started();
    const s1 = live(placeFace(s0, sol[0]));
    expect(s1.board[sol[0]]).toBe(Cell.Face);
    expect(s1.hearts).toBe(MAX_HEARTS);
    expect(s1.wrong.size).toBe(0);
    expect(s1.status).toBe("playing");
  });

  it("replaces the player's own mark on a correct cell", () => {
    const s1 = live(placeFace(toggleMark(started(), sol[0]), sol[0]));
    expect(s1.board[sol[0]]).toBe(Cell.Face);
    expect(s1.hearts).toBe(MAX_HEARTS);
  });

  it("spends a heart and locks a red mark on a wrong empty cell", () => {
    const c = wrongCellFor(uniqueLevel7);
    const s1 = live(placeFace(started(), c));
    expect(s1.board[c]).toBe(Cell.Mark);
    expect(s1.wrong.has(c)).toBe(true);
    expect(s1.hearts).toBe(MAX_HEARTS - 1);
    expect(s1.status).toBe("playing");
    expect(s1.board.includes(Cell.Face)).toBe(false);
  });

  it("treats a wrong face over the player's own mark the same way", () => {
    const c = wrongCellFor(uniqueLevel7);
    const s1 = live(placeFace(toggleMark(started(), c), c));
    expect(s1.board[c]).toBe(Cell.Mark);
    expect(s1.wrong.has(c)).toBe(true);
    expect(s1.hearts).toBe(MAX_HEARTS - 1);
  });

  it("returns the same state for locked cells", () => {
    const c = wrongCellFor(uniqueLevel7);
    const withWrong = placeFace(started(), c);
    const withFace = placeFace(started(), sol[0]);
    for (const s of [withWrong, withFace]) {
      const locked = s === withWrong ? c : sol[0];
      expect(placeFace(s, locked)).toBe(s);
      expect(toggleMark(s, locked)).toBe(s);
    }
    const w = live(withWrong);
    expect(w.hearts).toBe(MAX_HEARTS - 1);
    expect(w.board[c]).toBe(Cell.Mark);
  });

  it("loses at zero hearts and then ignores input", () => {
    let s: GameState = started();
    for (const c of bad.slice(0, MAX_HEARTS)) s = placeFace(s, c);
    const l = live(s);
    expect(l.status).toBe("lost");
    expect(l.hearts).toBe(0);
    expect(l.wrong.size).toBe(MAX_HEARTS);
    expect(placeFace(l, sol[0])).toBe(l);
    expect(toggleMark(l, sol[0])).toBe(l);
  });

  it("wins when every solution cell has a face", () => {
    let s: GameState = started();
    sol.forEach((c, i) => {
      s = placeFace(s, c);
      expect(live(s).status).toBe(i === sol.length - 1 ? "won" : "playing");
    });
    const w = live(s);
    expect(isSolved(w.board, w.level)).toBe(true);
    expect(w.hearts).toBe(MAX_HEARTS);
  });

  it("wins with one heart left", () => {
    let s: GameState = started();
    for (const c of bad.slice(0, MAX_HEARTS - 1)) s = placeFace(s, c);
    for (const c of sol) s = placeFace(s, c);
    const w = live(s);
    expect(w.status).toBe("won");
    expect(w.hearts).toBe(1);
  });

  it("won by play is inert", () => {
    let s: GameState = started();
    for (const c of sol) s = placeFace(s, c);
    const w = live(s);
    expect(w.status).toBe("won");
    for (const c of [bad[0], sol[0]]) {
      expect(placeFace(w, c)).toBe(w);
      expect(toggleMark(w, c)).toBe(w);
    }
  });

  it("checks status before the index", () => {
    const won = { ...started(), status: "won" as const };
    expect(placeFace(won, 999)).toBe(won);
    expect(placeFace(idleState, 0)).toBe(idleState);
  });

  for (const badIndex of [-1, uniqueLevel7.size ** 2, 1.5, Number.NaN]) {
    it(`throws RangeError for cell ${badIndex} while playing`, () => {
      expect(() => placeFace(started(), badIndex)).toThrow(RangeError);
    });
  }

  it("does not mutate the previous state", () => {
    const s0 = started();
    const boardSnap = s0.board.slice();
    const wrongSnap = new Set(s0.wrong);
    Object.freeze(s0);
    Object.freeze(s0.wrong);
    const a = live(placeFace(s0, sol[0]));
    const b = live(placeFace(s0, bad[0]));
    expect(s0.board).toEqual(boardSnap);
    expect(s0.wrong).toEqual(wrongSnap);
    expect(a.board).not.toBe(s0.board);
    expect(b.board).not.toBe(s0.board);
    expect(b.wrong).not.toBe(s0.wrong);
  });
});
