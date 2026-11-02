import { describe, expect, test } from "vitest";
import { countSolutions, validateLevel } from "../engine";
import { uniqueLevel7, uniqueLevel11 } from "../engine/__fixtures__/levels";
import { MAX_SIZE, MIN_SIZE } from "../engine/validate";
import { LEVELS, levelIndex } from "./campaign";

const byId = (id: string) => LEVELS[levelIndex(id)];

describe("campaign", () => {
  test("has 8 levels including a 7x7 and an 11x11", () => {
    expect(LEVELS).toHaveLength(8);
    expect(LEVELS.some((l) => l.size === 7)).toBe(true);
    expect(LEVELS.some((l) => l.size === 11)).toBe(true);
  });

  test("every level is valid, in range and uniquely solvable", () => {
    for (const level of LEVELS) {
      expect(validateLevel(level), level.id).toEqual([]);
      expect(level.size).toBeGreaterThanOrEqual(MIN_SIZE);
      expect(level.size).toBeLessThanOrEqual(MAX_SIZE);
      expect(countSolutions(level), level.id).toBe(1);
    }
  });

  test("ids are unique", () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  test("levelIndex finds each level and rejects unknown ids", () => {
    LEVELS.forEach((l, i) => {
      expect(levelIndex(l.id)).toBe(i);
    });
    expect(levelIndex("nope")).toBe(-1);
  });

  test("demo levels match the fixtures apart from id", () => {
    expect({ ...byId("demo-7"), id: "" }).toEqual({ ...uniqueLevel7, id: "" });
    expect({ ...byId("demo-11"), id: "" }).toEqual({
      ...uniqueLevel11,
      id: "",
    });
  });
});
