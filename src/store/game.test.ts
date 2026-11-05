import { describe, expect, it } from "vitest";
import { Cell, isSolved, type Level, nextHint } from "../engine";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { expertLevel1 } from "../engine/__fixtures__/rated";
import { solveByTechniques } from "../engine/solver";
import {
  type GameState,
  hint,
  idleState,
  isLocked,
  MAX_HEARTS,
  pause,
  placeFace,
  redo,
  restart,
  resume,
  startLevel,
  tick,
  toggleMark,
  undo,
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
    expect(state.hintsUsed).toBe(0);
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
    // Cells still empty at win time: a non-solution cell, never tapped.
    const probes = Array.from(
      { length: uniqueLevel7.size ** 2 },
      (_, i) => i,
    ).filter((i) => w.board[i] === Cell.Empty && !w.wrong.has(i));
    expect(probes).toContain(bad[0]);
    for (const c of probes) {
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

describe("isLocked", () => {
  const board = Uint8Array.from([Cell.Empty, Cell.Mark, Cell.Face, Cell.Mark]);
  const wrong = new Set([3]);
  it("locks faces and wrong marks only", () => {
    expect(isLocked(board, wrong, 0)).toBe(false);
    expect(isLocked(board, wrong, 1)).toBe(false);
    expect(isLocked(board, wrong, 2)).toBe(true);
    expect(isLocked(board, wrong, 3)).toBe(true);
  });
});

describe("clock and pause", () => {
  type Started = Exclude<GameState, { status: "idle" }>;
  const begin = (): Started => {
    const s = startLevel(uniqueLevel7);
    if (s.status === "idle") throw new Error("unreachable");
    return s;
  };
  const elapsed = (s: GameState) => (s.status === "idle" ? -1 : s.elapsedMs);

  it("startLevel and restart reset elapsedMs to 0", () => {
    expect(begin().elapsedMs).toBe(0);
    const ticked = tick(begin(), 5000);
    expect(elapsed(restart(ticked))).toBe(0);
  });

  it("tick adds dt while playing", () => {
    expect(elapsed(tick(tick(begin(), 400), 600))).toBe(1000);
  });

  it("tick ignores negative, NaN and infinite dt", () => {
    const s = begin();
    for (const dt of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(tick(s, dt)).toBe(s);
    }
  });

  it("tick is a no-op unless playing", () => {
    const s = begin();
    for (const status of ["paused", "won", "lost"] as const) {
      const state = { ...s, status };
      expect(tick(state, 100)).toBe(state);
    }
    expect(tick(idleState, 100)).toBe(idleState);
  });

  it("pause and resume switch playing and paused", () => {
    const p = pause(begin());
    expect(p.status).toBe("paused");
    expect(resume(p).status).toBe("playing");
  });

  it("pause and resume are no-ops in other states", () => {
    const s = begin();
    expect(resume(s)).toBe(s);
    for (const status of ["won", "lost"] as const) {
      const state = { ...s, status };
      expect(pause(state)).toBe(state);
      expect(resume(state)).toBe(state);
    }
    const p = pause(s);
    expect(pause(p)).toBe(p);
    expect(pause(idleState)).toBe(idleState);
    expect(resume(idleState)).toBe(idleState);
  });

  it("toggleMark and placeFace are no-ops while paused", () => {
    const p = pause(begin());
    expect(toggleMark(p, 0)).toBe(p);
    expect(placeFace(p, 0)).toBe(p);
  });

  it("restart while paused plays again from 0", () => {
    const p = pause(tick(begin(), 3000));
    const r = restart(p);
    expect(r.status).toBe("playing");
    expect(elapsed(r)).toBe(0);
  });

  it("winning and losing freeze elapsed", () => {
    const sol = uniqueLevel7.solution.map((c, r) => r * uniqueLevel7.size + c);
    let s: GameState = tick(begin(), 1234);
    for (const c of sol) s = placeFace(s, c);
    expect(s.status).toBe("won");
    expect(tick(s, 500)).toBe(s);
    expect(elapsed(s)).toBe(1234);
  });

  it("does not mutate the previous state", () => {
    const s = Object.freeze(begin());
    expect(tick(s, 10)).not.toBe(s);
    expect(pause(s)).not.toBe(s);
    expect(s.elapsedMs).toBe(0);
    expect(s.status).toBe("playing");
  });
});

describe("undo and redo", () => {
  type Started = Exclude<GameState, { status: "idle" }>;
  const live = (s: GameState): Started => {
    if (s.status === "idle") throw new Error("unreachable");
    return s;
  };
  const begin = (): Started => live(startLevel(uniqueLevel7));
  const size2 = uniqueLevel7.size ** 2;
  const sol = uniqueLevel7.solution.map((c, r) => r * uniqueLevel7.size + c);
  const bad = Array.from({ length: size2 }, (_, i) => i).filter(
    (i) => !sol.includes(i),
  );

  it("startLevel and restart give empty stacks", () => {
    expect(begin().history).toEqual([]);
    expect(begin().future).toEqual([]);
    const r = live(restart(toggleMark(begin(), 0)));
    expect(r.history).toEqual([]);
    expect(r.future).toEqual([]);
  });

  it("toggling an editable cell pushes it and clears redo", () => {
    const s1 = live(toggleMark(begin(), 4));
    expect(s1.history).toEqual([4]);
    expect(s1.future).toEqual([]);
    const s2 = live(toggleMark(s1, 4));
    expect(s2.history).toEqual([4, 4]);
  });

  it("toggling a locked cell or when not playing pushes nothing (regression)", () => {
    const withFace = live(placeFace(begin(), sol[0]));
    const withWrong = live(placeFace(begin(), bad[0]));
    expect(toggleMark(withFace, sol[0])).toBe(withFace);
    expect(toggleMark(withWrong, bad[0])).toBe(withWrong);
    const p = pause(begin());
    expect(toggleMark(p, 0)).toBe(p);
    for (const status of ["won", "lost"] as const) {
      const done = { ...begin(), status };
      expect(toggleMark(done, 0)).toBe(done);
    }
  });

  it("a locked toggle leaves redo alone", () => {
    let s: GameState = placeFace(begin(), sol[0]);
    s = undo(toggleMark(s, 5));
    expect(live(s).future).toEqual([5]);
    expect(live(toggleMark(s, sol[0])).future).toEqual([5]);
  });

  it("undo flips the cell back and moves it to redo", () => {
    const s1 = live(toggleMark(begin(), 4));
    const u = live(undo(s1));
    expect(u.board[4]).toBe(Cell.Empty);
    expect(u.history).toEqual([]);
    expect(u.future).toEqual([4]);
    expect(u.hearts).toBe(s1.hearts);
    expect(u.wrong).toBe(s1.wrong);
    expect(u.elapsedMs).toBe(s1.elapsedMs);
  });

  it("redo reapplies and redo(undo(s)) equals s", () => {
    let s: GameState = begin();
    for (const c of [1, 2, 1, 6]) s = toggleMark(s, c);
    s = tick(s, 700);
    expect(redo(undo(s))).toEqual(s);
    const r = live(redo(undo(s)));
    expect(r.board[6]).toBe(Cell.Mark);
    expect(r.future).toEqual([]);
    expect(r.history).toEqual([1, 2, 1, 6]);
  });

  it("undoes a removed note by restoring it", () => {
    const s = live(toggleMark(toggleMark(begin(), 3), 3));
    expect(s.board[3]).toBe(Cell.Empty);
    expect(live(undo(s)).board[3]).toBe(Cell.Mark);
  });

  it("are same-reference no-ops on empty stacks and when not playing", () => {
    const s = begin();
    expect(undo(s)).toBe(s);
    expect(redo(s)).toBe(s);
    expect(undo(idleState)).toBe(idleState);
    expect(redo(idleState)).toBe(idleState);
    const withHistory = live(toggleMark(begin(), 0));
    const undone = live(undo(withHistory));
    for (const status of ["paused", "won", "lost"] as const) {
      const a = { ...withHistory, status };
      expect(undo(a)).toBe(a);
      const b = { ...undone, status };
      expect(redo(b)).toBe(b);
    }
  });

  it("a new toggle after undo empties redo", () => {
    let s: GameState = toggleMark(toggleMark(begin(), 1), 2);
    s = undo(s);
    expect(live(s).future).toEqual([2]);
    s = toggleMark(s, 5);
    expect(live(s).future).toEqual([]);
    expect(live(s).history).toEqual([1, 5]);
  });

  it("placeFace prunes the cell from both stacks, correct face", () => {
    let s: GameState = begin();
    for (const c of [sol[0], 7, sol[0], 8]) s = toggleMark(s, c);
    s = undo(undo(s)); // history [sol0, 7], future [8, sol0]
    const placed = live(placeFace(s, sol[0]));
    expect(placed.history).toEqual([7]);
    expect(placed.future).toEqual([8]);
    expect(placed.hearts).toBe(MAX_HEARTS);
  });

  it("placeFace prunes on a wrong tap and does not refund the heart", () => {
    let s: GameState = begin();
    for (const c of [bad[0], bad[1], bad[0]]) s = toggleMark(s, c);
    s = undo(s);
    const placed = live(placeFace(s, bad[0]));
    expect(placed.history).toEqual([bad[1]]);
    expect(placed.future).toEqual([]);
    expect(placed.hearts).toBe(MAX_HEARTS - 1);
    const u = live(undo(placed));
    expect(u.hearts).toBe(MAX_HEARTS - 1);
    expect(u.board[bad[0]]).toBe(Cell.Mark);
    expect(u.wrong.has(bad[0])).toBe(true);
  });

  it("placeFace on a cell with no history keeps stacks", () => {
    const s = live(toggleMark(begin(), 7));
    expect(live(placeFace(s, sol[0])).history).toEqual([7]);
  });

  it("does not mutate frozen input", () => {
    const base = live(toggleMark(toggleMark(begin(), 1), 2));
    const undone = live(undo(base));
    for (const s of [base, undone]) {
      Object.freeze(s);
      Object.freeze(s.history);
      Object.freeze(s.future);
    }
    expect(undo(base)).not.toBe(base);
    expect(redo(undone)).not.toBe(undone);
    expect(base.history).toEqual([1, 2]);
    expect(undone.future).toEqual([2]);
  });

  function rng(seed: number) {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`keeps stack cells editable and hearts monotone (seed ${seed})`, () => {
      const rand = rng(seed);
      let s: GameState = begin();
      for (let i = 0; i < 400; i++) {
        const prevHearts = live(s).hearts;
        const r = rand();
        const cell = Math.floor(rand() * size2);
        if (r < 0.4) s = toggleMark(s, cell);
        else if (r < 0.55) s = placeFace(s, cell);
        else if (r < 0.65) s = hint(s);
        else if (r < 0.82) s = undo(s);
        else s = redo(s);
        const t = live(s);
        expect(t.hearts).toBeLessThanOrEqual(prevHearts);
        for (const c of [...t.history, ...t.future]) {
          expect(isLocked(t.board, t.wrong, c)).toBe(false);
        }
        if (t.status !== "playing") s = restart(s);
      }
    });
  }

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`a hint never takes the last heart (seed ${seed})`, () => {
      const rand = rng(seed);
      let s: GameState = begin();
      for (let i = 0; i < 400; i++) {
        const r = rand();
        const cell = Math.floor(rand() * size2);
        if (r < 0.6) s = hint(s);
        else if (r < 0.8) s = placeFace(s, cell);
        else s = toggleMark(s, cell);
        const t = live(s);
        if (t.status !== "lost") expect(t.hearts).toBeGreaterThanOrEqual(1);
        if (t.status !== "playing") s = restart(s);
      }
    });
  }
});

describe("hint", () => {
  type Started = Exclude<GameState, { status: "idle" }>;
  const live = (s: GameState): Started => {
    if (s.status === "idle") throw new Error("unreachable");
    return s;
  };
  const begin = (): Started => live(startLevel(uniqueLevel7));
  const { size, solution } = uniqueLevel7;
  const sol = solution.map((c, r) => r * size + c);
  const wrongCell = Array.from({ length: size * size }, (_, i) => i).find(
    (i) => !sol.includes(i),
  ) as number;
  // uniqueLevel7: the first ladder step places (4,2); the next two eliminate.
  const first = 4 * size + 2;
  const afterPlace = (): Started => live(hint(begin()));
  const elimHint = () => {
    const h = nextHint(afterPlace().board, uniqueLevel7);
    if (!h || h.deduction.place !== undefined) throw new Error("unreachable");
    return h;
  };

  it("places the ladder's first face and costs a heart", () => {
    const s1 = afterPlace();
    expect(s1.board[first]).toBe(Cell.Face);
    expect(s1.hearts).toBe(MAX_HEARTS - 1);
    expect(s1.hintsUsed).toBe(1);
    expect(s1.wrong.has(first)).toBe(false);
    expect(s1.status).toBe("playing");
  });

  it("explains a placement, highlighting the forcing cells", () => {
    const shown = afterPlace().hintShown;
    expect(shown?.cells).toEqual([first]);
    expect(shown?.targets).toEqual([]);
    expect(shown?.message).toMatch(/only one cell left/);
  });

  it("a placement hint records the placed cell; an elimination does not", () => {
    expect(afterPlace().hintShown?.placed).toBe(first);
    expect(live(hint(afterPlace())).hintShown?.placed).toBeUndefined();
  });

  it("an elimination hint highlights and explains but writes no marks", () => {
    const s1 = afterPlace();
    const h = elimHint();
    const s2 = live(hint(s1));
    expect(s2.board).toEqual(s1.board);
    expect(s2.history).toEqual(s1.history);
    expect(s2.future).toEqual(s1.future);
    expect(s2.hearts).toBe(MAX_HEARTS - 2);
    expect(s2.hintsUsed).toBe(2);
    expect(s2.hintShown).toEqual({
      cells: h.deduction.because.cells,
      targets: h.deduction.eliminate,
      message: h.message,
      deduction: h.deduction,
    });
  });

  it("a lookahead hint highlights the assumed cell for a heart and writes nothing", () => {
    const start = live(startLevel(expertLevel1));
    const { steps } = solveByTechniques(expertLevel1);
    const at = steps.findIndex((s) => s.technique === "lookahead");
    const board = start.board.slice();
    for (const s of steps.slice(0, at)) {
      if (s.place !== undefined) board[s.place] = Cell.Face;
      else for (const i of s.eliminate) board[i] = Cell.Mark;
    }
    const s1 = live(hint({ ...start, board }));
    expect(s1.board).toEqual(board);
    expect(s1.hearts).toBe(MAX_HEARTS - 1);
    expect(s1.hintShown).toEqual({
      cells: steps[at].because.cells,
      targets: steps[at].eliminate,
      message: expect.stringMatching(/after the forced moves/),
      deduction: steps[at],
    });
  });

  it("a placement hint that wins the level leaves no hint on display", () => {
    const start = begin();
    const board = start.board.slice();
    for (const c of sol.slice(0, -1)) board[c] = Cell.Face;
    const won = hint({ ...start, board });
    expect(won.status).toBe("won");
    expect(live(won).board[sol[sol.length - 1]]).toBe(Cell.Face);
    expect(live(won).hintShown).toBeNull();
  });

  it("asking again for the hint on display spends nothing", () => {
    const s2 = live(hint(afterPlace()));
    expect(hint(s2)).toBe(s2);
  });

  it("advances once the player has marked the eliminations", () => {
    const h = elimHint();
    let s: GameState = afterPlace();
    for (const c of h.deduction.eliminate) s = toggleMark(s, c);
    const next = live(hint(s));
    expect(next.hintShown?.message).not.toBe(h.message);
    expect(next.hearts).toBe(MAX_HEARTS - 2);
  });

  it("clears the display on a mark, a face, undo, redo, restart and pause", () => {
    const shown = live(hint(afterPlace()));
    expect(shown.hintShown).not.toBeNull();
    const cell = shown.hintShown?.targets[0] as number;
    const marked = live(toggleMark(shown, cell));
    expect(marked.hintShown).toBeNull();
    expect(live(undo(marked)).hintShown).toBeNull();
    expect(live(placeFace(shown, sol[0])).hintShown).toBeNull();
    expect(live(pause(shown)).hintShown).toBeNull();
    expect(live(restart(shown)).hintShown).toBeNull();
    const redone = live(redo(undo(marked)));
    expect(redone.hintShown).toBeNull();
    // A no-op tap keeps it.
    expect(placeFace(shown, first)).toBe(shown);
  });

  it("starts with nothing shown", () => {
    expect(begin().hintShown).toBeNull();
  });

  it("leaves time alone", () => {
    const s0 = live(tick(begin(), 900));
    expect(live(hint(s0)).elapsedMs).toBe(900);
  });

  it("can win with one row left and spare hearts", () => {
    let s: GameState = begin();
    for (const c of sol.slice(0, -1)) s = placeFace(s, c);
    const w = live(hint(s));
    expect(w.status).toBe("won");
    expect(w.hearts).toBe(MAX_HEARTS - 1);
    expect(isSolved(w.board, w.level)).toBe(true);
  });

  it("is refused on the last heart, never losing", () => {
    let s: GameState = begin();
    for (let i = 0; i < MAX_HEARTS - 1; i++) s = hint(s);
    expect(live(s).hearts).toBe(1);
    expect(hint(s)).toBe(s);
    expect(live(s).status).toBe("playing");
  });

  it("is a same-reference no-op unless playing", () => {
    const base = begin();
    expect(hint(idleState)).toBe(idleState);
    for (const status of ["paused", "won", "lost"] as const) {
      const a = { ...base, status };
      expect(hint(a)).toBe(a);
    }
  });

  it("is a no-op when there is nothing to hint", () => {
    const full = live(
      sol.reduce<GameState>((s, c) => placeFace(s, c), begin()),
    );
    const s = { ...full, status: "playing" as const };
    expect(hint(s)).toBe(s);
  });

  it("overwrites the player's note and prunes it from both stacks", () => {
    let s: GameState = begin();
    for (const c of [first, 7, first, 8]) s = toggleMark(s, c);
    s = undo(undo(s)); // history [first, 7], future [8, first]
    const h = live(hint(s));
    expect(h.board[first]).toBe(Cell.Face);
    expect(h.history).toEqual([7]);
    expect(h.future).toEqual([8]);
  });

  it("keeps wrong marks and their stacks intact", () => {
    const s0 = live(placeFace(begin(), wrongCell));
    const h = live(hint(s0));
    expect(h.wrong).toEqual(s0.wrong);
    expect(h.hearts).toBe(MAX_HEARTS - 2);
  });

  it("does not mutate the previous state", () => {
    const s0 = begin();
    const snap = s0.board.slice();
    Object.freeze(s0);
    Object.freeze(s0.wrong);
    Object.freeze(s0.history);
    const h = live(hint(s0));
    expect(s0.board).toEqual(snap);
    expect(h.board).not.toBe(s0.board);
  });

  it("restart resets hintsUsed", () => {
    const r = live(restart(hint(begin())));
    expect(r.hintsUsed).toBe(0);
    expect(r.hearts).toBe(MAX_HEARTS);
  });
});
