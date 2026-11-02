import { describe, expect, test } from "vitest";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { idleState, placeFace, startLevel, toggleMark } from "./game";
import { fromSaved, toSaved } from "./persist";

describe("toSaved", () => {
  test("is null for idle", () => {
    expect(toSaved(idleState)).toBeNull();
  });

  test("is null for won and lost", () => {
    const s = startLevel(uniqueLevel7);
    expect(toSaved({ ...s, status: "won" })).toBeNull();
    expect(toSaved({ ...s, status: "lost" })).toBeNull();
  });

  test("a playing game saves its six fields", () => {
    const s = toggleMark(startLevel(uniqueLevel7), 3);
    if (s.status === "idle") throw new Error("started");
    const playing = { ...s, hearts: 2, hintsUsed: 1, elapsedMs: 4200, wrong: new Set([9, 5]) };
    expect(toSaved(playing)).toEqual({
      levelId: uniqueLevel7.id,
      board: Array.from(playing.board),
      wrong: [5, 9],
      hearts: 2,
      elapsedMs: 4200,
      hintsUsed: 1,
    });
  });
});

describe("toSaved paused", () => {
  test("a paused game saves the same fields", () => {
    const s = startLevel(uniqueLevel7);
    if (s.status === "idle") throw new Error("started");
    expect(toSaved({ ...s, status: "paused", elapsedMs: 7 })?.elapsedMs).toBe(7);
  });
});

/** A started game with a mark at one cell and one wrong tap. */
function played() {
  const n = uniqueLevel7.size;
  const wrongCell = uniqueLevel7.solution[0] === 0 ? 1 : 0;
  const s = placeFace(toggleMark(startLevel(uniqueLevel7), n + 3), wrongCell);
  if (s.status === "idle") throw new Error("started");
  return { s, wrongCell };
}

describe("fromSaved", () => {
  test("round-trips to a paused game with a Set and empty stacks", () => {
    const { s, wrongCell } = played();
    const got = fromSaved(toSaved({ ...s, elapsedMs: 800 }), uniqueLevel7);
    expect(got).toMatchObject({
      status: "paused",
      level: uniqueLevel7,
      hearts: 2,
      elapsedMs: 800,
      hintsUsed: 0,
      history: [],
      future: [],
    });
    expect(got?.wrong).toEqual(new Set([wrongCell]));
    expect(Array.from(got?.board ?? [])).toEqual(Array.from(s.board));
  });
});
