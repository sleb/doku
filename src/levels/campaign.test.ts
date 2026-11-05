import { describe, expect, test } from "vitest";
import { countSolutions, rate, validateLevel } from "../engine";
import { MAX_SIZE, MIN_SIZE } from "../engine/validate";
import { LEVELS, levelIndex } from "./campaign";

describe("campaign", () => {
  test("covers several sizes and ramps in tier", () => {
    const sizes = new Set(LEVELS.map((l) => l.size));
    expect(sizes.size).toBeGreaterThanOrEqual(4);
    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(MIN_SIZE);
      expect(size).toBeLessThanOrEqual(MAX_SIZE);
    }
    expect(new Set(LEVELS.map((l) => l.tier)).size).toBeGreaterThanOrEqual(2);
  });

  test("every level has a tier that rate() agrees with", () => {
    for (const level of LEVELS) {
      expect(level.tier, level.id).toBeDefined();
      expect(rate(level), level.id).toBe(level.tier);
    }
  });

  test("tiers never decrease along the pack", () => {
    const order = ["easy", "medium", "hard", "expert"];
    const ranks = LEVELS.map((l) => order.indexOf(l.tier ?? ""));
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
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
