import { describe, expect, test } from "vitest";
import { countSolutions, validateLevel } from "../engine";
import { MAX_SIZE, MIN_SIZE } from "../engine/validate";
import { LEVELS, levelIndex } from "./campaign";

describe("campaign", () => {
  test("is a full campaign covering every size, with several 11x11", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(40);
    for (let size = MIN_SIZE; size <= MAX_SIZE; size++) {
      expect(
        LEVELS.some((l) => l.size === size),
        `size ${size}`,
      ).toBe(true);
    }
    expect(LEVELS.filter((l) => l.size === 11).length).toBeGreaterThanOrEqual(
      5,
    );
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
});
