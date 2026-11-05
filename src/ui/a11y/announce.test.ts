import { describe, expect, test } from "vitest";
import type { Outcome } from "../../platform/outcome";
import {
  announce,
  announceInputMode,
  announceLevelStart,
  announcePause,
  announceResume,
} from "./announce";

const place = (faces: number): Outcome => ({
  kind: "place",
  cell: 2 * 8 + 4,
  faces,
  hearts: 3,
});
const wrong = (hearts: number): Outcome => ({
  kind: "wrong",
  cell: 2 * 8 + 4,
  faces: 1,
  hearts,
});

describe("announce", () => {
  test("place names the cell and the progress", () => {
    expect(announce(place(4), { size: 8 })).toBe(
      "Face placed, row 3, column 5. 4 of 8 placed.",
    );
  });

  test("wrong names the cell and the hearts, singular and plural", () => {
    expect(announce(wrong(2), { size: 8 })).toBe(
      "Not there. Row 3, column 5 is wrong. 2 hearts left.",
    );
    expect(announce(wrong(1), { size: 8 })).toBe(
      "Not there. Row 3, column 5 is wrong. 1 heart left.",
    );
  });

  test("tutorial drops the hearts sentence", () => {
    expect(announce(wrong(2), { size: 8, tutorial: true })).toBe(
      "Not there. Row 3, column 5 is wrong.",
    );
  });

  test("win formats the time", () => {
    const win: Outcome = { kind: "win", faces: 8, hearts: 3 };
    expect(announce(win, { size: 8, elapsedMs: 83_000 })).toBe(
      "Solved in 1 minute 23 seconds.",
    );
    expect(announce(win, { size: 8, elapsedMs: 120_000 })).toBe(
      "Solved in 2 minutes.",
    );
    expect(announce(win, { size: 8, elapsedMs: 1_000 })).toBe(
      "Solved in 1 second.",
    );
  });

  test("win adds New best only when elapsed is at most the best", () => {
    const win: Outcome = { kind: "win", faces: 8, hearts: 3 };
    expect(announce(win, { size: 8, elapsedMs: 83_000, bestMs: 83_000 })).toBe(
      "Solved in 1 minute 23 seconds. New best.",
    );
    expect(announce(win, { size: 8, elapsedMs: 90_000, bestMs: 83_000 })).toBe(
      "Solved in 1 minute 30 seconds.",
    );
  });

  test("lose", () => {
    const lose: Outcome = { kind: "lose", cell: 0, faces: 1, hearts: 0 };
    expect(announce(lose, { size: 8 })).toBe(
      "Out of hearts. Retry is available.",
    );
  });

  test("builders", () => {
    expect(announceLevelStart(3, 20, 9)).toBe("Level 3 of 20, 9 by 9.");
    expect(announcePause()).toBe("Paused.");
    expect(announceResume()).toBe("Resumed.");
    expect(announceInputMode("face")).toBe("Tapping now places faces.");
    expect(announceInputMode("mark")).toBe("Tapping now marks cells.");
  });
});
