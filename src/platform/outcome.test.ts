import { describe, expect, it } from "vitest";
import { nextHint } from "../engine";
import { uniqueLevel7 as level } from "../engine/__fixtures__/levels";
import {
  type GameState,
  hint,
  idleState,
  placeFace,
  restart,
  startLevel,
  toggleMark,
} from "../store/game";
import { type Outcome, outcomeFor } from "./outcome";

const n = level.size;
const solution = level.solution.map((c, r) => r * n + c);
const wrongCells = Array.from({ length: n * n }, (_, i) => i).filter(
  (i) => !solution.includes(i),
);

function play(state: GameState, cells: number[]): GameState {
  return cells.reduce(placeFace, state);
}

const fresh = () => startLevel(level);
const lost = () => play(fresh(), wrongCells.slice(0, 3));
const won = () => play(fresh(), solution);

describe("outcomeFor", () => {
  it("is place for a correct face", () => {
    const prev = fresh();
    expect(outcomeFor(prev, placeFace(prev, solution[0]))?.kind).toBe("place");
  });

  it("is wrong for a wrong face that costs a heart", () => {
    const prev = fresh();
    expect(outcomeFor(prev, placeFace(prev, wrongCells[0]))?.kind).toBe(
      "wrong",
    );
  });

  it("is win, not place, for the final correct face", () => {
    const prev = play(fresh(), solution.slice(0, -1));
    const next = placeFace(prev, solution[solution.length - 1]);
    expect(next.status).toBe("won");
    expect(outcomeFor(prev, next)?.kind).toBe("win");
  });

  it("is lose, not wrong, for the last heart", () => {
    const prev = play(fresh(), wrongCells.slice(0, 2));
    const next = placeFace(prev, wrongCells[2]);
    expect(next.status).toBe("lost");
    expect(outcomeFor(prev, next)?.kind).toBe("lose");
  });

  it("is place for a hint, though it costs a heart", () => {
    const prev = fresh();
    const next = hint(prev);
    expect(next).not.toBe(prev);
    expect(outcomeFor(prev, next)?.kind).toBe("place");
  });

  it("is win, not place, for a hint that finishes the board", () => {
    const prev = play(fresh(), solution.slice(0, -1));
    const next = hint(prev);
    expect(next.status).toBe("won");
    expect(outcomeFor(prev, next)?.kind).toBe("win");
  });

  it("is null for a refused hint", () => {
    const prev = hint(hint(fresh()));
    expect(outcomeFor(prev, hint(prev))).toBeNull();
  });

  it("is null for mark toggles on and off", () => {
    const a = fresh();
    const b = toggleMark(a, wrongCells[0]);
    expect(outcomeFor(a, b)).toBeNull();
    expect(outcomeFor(b, toggleMark(b, wrongCells[0]))).toBeNull();
  });

  it("is null for restart, startLevel, idle, same reference, and ended games", () => {
    expect(outcomeFor(won(), restart(won()))).toBeNull();
    expect(outcomeFor(lost(), restart(lost()))).toBeNull();
    expect(outcomeFor(idleState, fresh())).toBeNull();
    expect(outcomeFor(play(fresh(), [solution[0]]), fresh())).toBeNull();
    expect(outcomeFor(fresh(), idleState)).toBeNull();
    expect(outcomeFor(idleState, idleState)).toBeNull();
    const s = fresh();
    expect(outcomeFor(s, s)).toBeNull();
    const w = won();
    expect(outcomeFor(w, w)).toBeNull();
  });

  it("carries the changed cell, faces and hearts for a place", () => {
    const prev = fresh();
    expect(outcomeFor(prev, placeFace(prev, solution[0]))).toEqual({
      kind: "place",
      cell: solution[0],
      faces: 1,
      hearts: 3,
    });
  });

  it("carries the new locked cell and fewer hearts for a wrong", () => {
    const prev = fresh();
    expect(outcomeFor(prev, placeFace(prev, wrongCells[0]))).toEqual({
      kind: "wrong",
      cell: wrongCells[0],
      faces: 0,
      hearts: 2,
    });
  });

  it("keeps the cell for a lose caused by the last heart", () => {
    const prev = play(fresh(), wrongCells.slice(0, 2));
    expect(outcomeFor(prev, placeFace(prev, wrongCells[2]))).toEqual({
      kind: "lose",
      cell: wrongCells[2],
      faces: 0,
      hearts: 0,
    });
  });

  it("carries the committed cell for a hint", () => {
    const prev = fresh();
    const o = outcomeFor(prev, hint(prev)) as Outcome;
    expect(o.kind).toBe("place");
    expect(o.kind !== "win" && solution).toContain(
      o.kind !== "win" ? o.cell : -1,
    );
    expect(o.faces).toBe(1);
    expect(o.hearts).toBe(2);
  });

  it("carries the cell for a wrong face on a pre-marked cell", () => {
    const prev = toggleMark(fresh(), wrongCells[0]);
    const o = outcomeFor(prev, placeFace(prev, wrongCells[0])) as Outcome;
    expect(o.kind).toBe("wrong");
    expect("cell" in o).toBe(true);
    expect(o.kind !== "win" && o.cell).toBe(wrongCells[0]);
  });

  it("carries the cell for a hint landing on a pre-marked cell", () => {
    const base = fresh();
    const target = nextHint(base.board as never, level)?.deduction
      .place as number;
    const prev = toggleMark(base, target);
    const o = outcomeFor(prev, hint(prev)) as Outcome;
    expect(o.kind).toBe("place");
    expect(o.kind !== "win" && o.cell).toBe(target);
  });

  it("always has a numeric cell for non-win outcomes", () => {
    const p = fresh();
    for (const next of [
      placeFace(p, solution[0]),
      placeFace(p, wrongCells[0]),
      hint(p),
    ]) {
      const o = outcomeFor(p, next) as Outcome;
      expect("cell" in o).toBe(true);
      expect(typeof (o as { cell: number }).cell).toBe("number");
    }
  });

  it("has no cell key for a win", () => {
    const prev = play(fresh(), solution.slice(0, -1));
    const o = outcomeFor(prev, placeFace(prev, solution[n - 1])) as Outcome;
    expect(o.kind).toBe("win");
    expect("cell" in o).toBe(false);
    expect(o.faces).toBe(n);
  });

  it("does not mutate its inputs", () => {
    const prev = fresh();
    const next = placeFace(prev, solution[0]);
    const snap = structuredClone([prev, next]);
    outcomeFor(prev, next);
    expect([prev, next]).toEqual(snap);
  });
});
