import { describe, expect, it } from "vitest";
import { defaultShape, passesShape, randomSolution } from "./generator";
import { makeRng } from "./seed";

const SIZES = [7, 8, 9, 10, 11];

describe("randomSolution", () => {
  it.each(SIZES)("is a spaced permutation for n=%i", (n) => {
    for (let s = 0; s < 200; s++) {
      const sol = randomSolution(n, makeRng(`s${s}`));
      expect(sol).toHaveLength(n);
      expect([...sol].sort((a, b) => a - b)).toEqual(
        Array.from({ length: n }, (_, i) => i),
      );
      for (let r = 1; r < n; r++) {
        expect(Math.abs(sol[r] - sol[r - 1])).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("is deterministic", () => {
    expect(randomSolution(9, makeRng("a"))).toEqual(
      randomSolution(9, makeRng("a")),
    );
  });
});

// Region sizes only matter to passesShape, so a flat grid of ids is enough.
const gridWithSizes = (n: number, sizes: number[]): number[][] => {
  const flat = sizes.flatMap((s, id) => Array<number>(s).fill(id));
  return Array.from({ length: n }, (_, r) => flat.slice(r * n, r * n + n));
};

describe("defaultShape", () => {
  it("scales singletons and maxRegion with size", () => {
    expect(defaultShape(7).maxSingletons).toBe(1);
    expect(defaultShape(8).maxSingletons).toBe(1);
    for (const n of [9, 10, 11]) expect(defaultShape(n).maxSingletons).toBe(2);
    expect(defaultShape(7).minRegion).toBe(2);
    expect(defaultShape(7).maxRegion).toBe(Math.ceil(0.35 * 49));
    expect(defaultShape(11).maxRegion).toBe(Math.ceil(0.35 * 121));
  });
});

describe("passesShape", () => {
  const shape = { minRegion: 2, maxSingletons: 1, maxRegion: 17 };
  // 7 regions summing to 49.
  it("accepts up to maxSingletons one-cell regions and rejects one more", () => {
    expect(passesShape(gridWithSizes(7, [1, 8, 8, 8, 8, 8, 8]), shape)).toBe(
      true,
    );
    expect(passesShape(gridWithSizes(7, [1, 1, 8, 8, 8, 8, 15]), shape)).toBe(
      false,
    );
    expect(passesShape(gridWithSizes(7, [7, 7, 7, 7, 7, 7, 7]), shape)).toBe(
      true,
    );
  });

  it("rejects regions over maxRegion", () => {
    expect(passesShape(gridWithSizes(7, [18, 5, 5, 5, 5, 5, 6]), shape)).toBe(
      false,
    );
    expect(passesShape(gridWithSizes(7, [17, 5, 5, 5, 5, 6, 6]), shape)).toBe(
      true,
    );
  });

  it("rejects a region below minRegion that is not an allowed singleton", () => {
    expect(
      passesShape(gridWithSizes(7, [3, 8, 8, 8, 8, 8, 6]), {
        ...shape,
        minRegion: 4,
      }),
    ).toBe(false);
  });

  it("rejects an empty region id (size 0)", () => {
    const g = gridWithSizes(7, [10, 8, 8, 8, 8, 7]);
    expect(passesShape(g, shape)).toBe(false);
  });
});
