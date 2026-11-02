import { describe, expect, test } from "vitest";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { idleState, startLevel, toggleMark } from "./game";
import { toSaved } from "./persist";

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
