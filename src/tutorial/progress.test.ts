import { describe, expect, test } from "vitest";
import { Cell } from "../engine";
import { type Started, startLevel } from "../store/game";
import { evaluate } from "./progress";
import { STEPS, type TutorialStep } from "./steps";

const step = (id: string): TutorialStep => {
  const s = STEPS.find((x) => x.id === id);
  if (!s) throw new Error(id);
  return s;
};

function fresh(s: TutorialStep): Started {
  const st = startLevel(s.level) as Started;
  return { ...st, board: s.start };
}

function with_(
  s: Started,
  patch: { board?: [number, Cell][]; wrong?: number[]; future?: number[] },
): Started {
  const board = s.board.slice();
  for (const [i, c] of patch.board ?? []) board[i] = c;
  return {
    ...s,
    board,
    wrong: new Set([...s.wrong, ...(patch.wrong ?? [])]),
    future: patch.future ?? s.future,
  };
}

describe("evaluate", () => {
  test("a fresh step is in progress", () => {
    for (const s of STEPS) expect(evaluate(s, fresh(s))).toBe("progress");
  });

  test("an idle store is in progress", () => {
    expect(
      evaluate(step("region"), {
        status: "idle",
        level: null,
        board: null,
        hearts: 3,
      }),
    ).toBe("progress");
  });

  test("a face goal completes when the face is placed", () => {
    const s = step("region");
    expect(evaluate(s, with_(fresh(s), { board: [[13, Cell.Face]] }))).toBe(
      "complete",
    );
  });

  test("all goals are needed", () => {
    const s = step("lines");
    const f = fresh(s);
    expect(evaluate(s, with_(f, { board: [[17, Cell.Face]] }))).toBe(
      "progress",
    );
    expect(
      evaluate(
        s,
        with_(f, {
          board: [
            [17, Cell.Face],
            [24, Cell.Face],
          ],
        }),
      ),
    ).toBe("complete");
  });

  test("a wrong tap breaks a step that does not expect one", () => {
    const s = step("region");
    expect(
      evaluate(s, with_(fresh(s), { board: [[0, Cell.Mark]], wrong: [0] })),
    ).toBe("broken");
  });

  test("a mark goal needs a real note, not a wrong one", () => {
    const s = step("touching");
    expect(evaluate(s, with_(fresh(s), { board: [[6, Cell.Mark]] }))).toBe(
      "complete",
    );
  });

  test("a note on a solution cell breaks the lesson", () => {
    const s = step("touching");
    // Row 1 holds its face at column 4 (cell 8).
    expect(evaluate(s, with_(fresh(s), { board: [[8, Cell.Mark]] }))).toBe(
      "broken",
    );
  });

  test("an undone goal needs the note placed and then taken back", () => {
    const s = step("notes");
    const f = fresh(s);
    const both = with_(f, {
      board: [
        [1, Cell.Mark],
        [6, Cell.Mark],
      ],
    });
    expect(evaluate(s, both)).toBe("progress");
    const undone = with_(f, { board: [[1, Cell.Mark]], future: [6] });
    expect(evaluate(s, undone)).toBe("complete");
  });

  test("the hearts step completes on the expected wrong tap plus the right face", () => {
    const s = step("hearts");
    const wrongOnly = with_(fresh(s), {
      board: [[14, Cell.Mark]],
      wrong: [14],
    });
    expect(evaluate(s, wrongOnly)).toBe("progress");
    expect(evaluate(s, with_(wrongOnly, { board: [[11, Cell.Face]] }))).toBe(
      "complete",
    );
  });

  test("the hearts step breaks on a different wrong tap", () => {
    const s = step("hearts");
    expect(
      evaluate(s, with_(fresh(s), { board: [[13, Cell.Mark]], wrong: [13] })),
    ).toBe("broken");
  });
});
