import { describe, expect, test } from "vitest";
import { uniqueLevel7 } from "../engine/__fixtures__/levels";
import { Cell } from "../engine";
import { idleState, placeFace, startLevel, toggleMark } from "./game";
import { fromSaved, type SavedGame, toSaved } from "./persist";

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

function validSave() {
  return toSaved(played().s) as SavedGame;
}

describe("fromSaved rejects", () => {
  test.each([undefined, null, 42, "x", [1]])("non-object %j", (raw) => {
    expect(fromSaved(raw, uniqueLevel7)).toBeNull();
  });
});

describe("fromSaved level id", () => {
  test("a save for another level is rejected", () => {
    expect(fromSaved({ ...validSave(), levelId: "other" }, uniqueLevel7)).toBeNull();
  });
});

describe("fromSaved board", () => {
  test.each([
    ["short", (b: number[]) => b.slice(1)],
    ["long", (b: number[]) => [...b, 0]],
    ["not an array", () => "0000"],
  ])("a %s board is rejected", (_n, mutate) => {
    const save = validSave();
    const bad = { ...save, board: mutate(save.board) };
    expect(fromSaved(bad, uniqueLevel7)).toBeNull();
  });
});

describe("fromSaved cell values", () => {
  test.each([3, -1, 1.5, "1", null])("cell value %j is rejected", (v) => {
    const save = validSave();
    const board: unknown[] = [...save.board];
    board[0] = v;
    expect(fromSaved({ ...save, board }, uniqueLevel7)).toBeNull();
  });
});

describe("fromSaved wrong cells", () => {
  const w = () => validSave().wrong[0];
  test.each([
    ["out of range", () => [49]],
    ["negative", () => [-1]],
    ["fractional", () => [1.5]],
    ["duplicate", () => [w(), w()]],
    ["not a mark", () => [w() === 0 ? 2 : 0]],
    ["not an array", () => "1"],
  ])("%s is rejected", (_n, wrong) => {
    expect(fromSaved({ ...validSave(), wrong: wrong() }, uniqueLevel7)).toBeNull();
  });
});

describe("fromSaved hearts", () => {
  test.each([0, 4, -1, 1.5, "2", null, Number.NaN])("%j is rejected", (hearts) => {
    expect(fromSaved({ ...validSave(), hearts }, uniqueLevel7)).toBeNull();
  });
});

describe("fromSaved elapsed", () => {
  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY, "5", null])("%j is rejected", (elapsedMs) => {
    expect(fromSaved({ ...validSave(), elapsedMs }, uniqueLevel7)).toBeNull();
  });
});

describe("fromSaved hintsUsed", () => {
  test.each([-1, 1.5, Number.NaN, "1", null, undefined])("%j is rejected", (hintsUsed) => {
    expect(fromSaved({ ...validSave(), hintsUsed }, uniqueLevel7)).toBeNull();
  });
});

describe("fromSaved faces", () => {
  test("a face on a cell the solution does not use is rejected", () => {
    const save = validSave();
    const board = [...save.board];
    board[0] = Cell.Face;
    const bad = uniqueLevel7.solution[0] === 0 ? 1 : 0;
    board[bad] = Cell.Face;
    expect(fromSaved({ ...save, board, wrong: [] }, uniqueLevel7)).toBeNull();
  });

  test("an already-solved board is rejected", () => {
    const n = uniqueLevel7.size;
    const board = new Array<number>(n * n).fill(Cell.Empty);
    uniqueLevel7.solution.forEach((c, r) => {
      board[r * n + c] = Cell.Face;
    });
    expect(fromSaved({ ...validSave(), board, wrong: [] }, uniqueLevel7)).toBeNull();
  });
});
