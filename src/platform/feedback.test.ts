import { describe, expect, it } from "vitest";
import { uniqueLevel7 as level } from "../engine/__fixtures__/levels";
import {
  type GameState,
  idleState,
  placeFace,
  restart,
  startLevel,
  toggleMark,
} from "../store/game";
import { feedbackFor } from "./feedback";

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

describe("feedbackFor", () => {
  it("is place for a correct face", () => {
    const prev = fresh();
    expect(feedbackFor(prev, placeFace(prev, solution[0]))).toBe("place");
  });

  it("is wrong for a wrong face that costs a heart", () => {
    const prev = fresh();
    expect(feedbackFor(prev, placeFace(prev, wrongCells[0]))).toBe("wrong");
  });

  it("is win, not place, for the final correct face", () => {
    const prev = play(fresh(), solution.slice(0, -1));
    const next = placeFace(prev, solution[solution.length - 1]);
    expect(next.status).toBe("won");
    expect(feedbackFor(prev, next)).toBe("win");
  });

  it("is lose, not wrong, for the last heart", () => {
    const prev = play(fresh(), wrongCells.slice(0, 2));
    const next = placeFace(prev, wrongCells[2]);
    expect(next.status).toBe("lost");
    expect(feedbackFor(prev, next)).toBe("lose");
  });

  it("is null for mark toggles on and off", () => {
    const a = fresh();
    const b = toggleMark(a, wrongCells[0]);
    expect(feedbackFor(a, b)).toBeNull();
    expect(feedbackFor(b, toggleMark(b, wrongCells[0]))).toBeNull();
  });

  it("is null for restart, startLevel, idle, same reference, and ended games", () => {
    expect(feedbackFor(won(), restart(won()))).toBeNull();
    expect(feedbackFor(lost(), restart(lost()))).toBeNull();
    expect(feedbackFor(idleState, fresh())).toBeNull();
    expect(feedbackFor(play(fresh(), [solution[0]]), fresh())).toBeNull();
    expect(feedbackFor(fresh(), idleState)).toBeNull();
    expect(feedbackFor(idleState, idleState)).toBeNull();
    const s = fresh();
    expect(feedbackFor(s, s)).toBeNull();
    const w = won();
    expect(feedbackFor(w, w)).toBeNull();
  });

  it("does not mutate its inputs", () => {
    const prev = fresh();
    const next = placeFace(prev, solution[0]);
    const snap = structuredClone([prev, next]);
    feedbackFor(prev, next);
    expect([prev, next]).toEqual(snap);
  });
});
