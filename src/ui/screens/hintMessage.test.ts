import { describe, expect, test } from "vitest";
import { uniqueLevel7 } from "../../engine/__fixtures__/levels";
import { hint, startLevel } from "../../store/game";
import { hintMessage } from "./hintMessage";

const shown = () => {
  const s = hint(startLevel(uniqueLevel7));
  if (s.status !== "playing" || !s.hintShown) throw new Error("no hint");
  return s.hintShown;
};

describe("hintMessage", () => {
  test("names regions by colour on the default palette", () => {
    const h = shown();
    expect(hintMessage(h, { palette: "default", patterns: false })).toBe(
      h.message,
    );
    expect(h.message).toMatch(/region/);
  });

  test("uses region numbers on the accessible palette", () => {
    const text = hintMessage(shown(), {
      palette: "accessible",
      patterns: false,
    });
    expect(text).toMatch(/[Rr]egion \d+/);
    expect(text).not.toMatch(/the \w+ region/);
  });

  test("uses region numbers when patterns are on", () => {
    expect(
      hintMessage(shown(), { palette: "default", patterns: true }),
    ).toMatch(/[Rr]egion \d+/);
  });
});
