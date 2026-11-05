import { describe, expect, it } from "vitest";
import {
  defaultShape,
  growRegions,
  passesShape,
  randomSolution,
} from "./generator";
import { multiSolutionLevel7 } from "./__fixtures__/levels";
import { type Rng, makeRng } from "./seed";
import { countSolutions } from "./solver";
import type { Level } from "./types";
import { validateLevel } from "./validate";

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

const asLevel = (
  n: number,
  regions: number[][],
  solution: number[],
): Level => ({
  id: "t",
  size: n,
  regions,
  solution,
});

describe("growRegions", () => {
  it.each(SIZES)("grows connected one-solution-cell regions for n=%i", (n) => {
    let shapeOk = 0;
    const seeds = 100;
    for (let s = 0; s < seeds; s++) {
      const rng = makeRng(`g${s}`);
      const solution = randomSolution(n, rng);
      const regions = growRegions(n, solution, rng, defaultShape(n));
      const issues = validateLevel(asLevel(n, regions, solution));
      expect(issues).toEqual([]);
      solution.forEach((c, r) => {
        expect(regions[r][c]).toBe(r);
      });
      if (passesShape(regions, defaultShape(n))) shapeOk++;
    }
    expect(shapeOk / seeds).toBeGreaterThanOrEqual(0.9);
  });

  it("is deterministic", () => {
    const run = () => {
      const rng = makeRng("d");
      const solution = randomSolution(8, rng);
      return growRegions(8, solution, rng, defaultShape(8));
    };
    expect(run()).toEqual(run());
  });
});

describe("repairUniqueness", () => {
  const level = multiSolutionLevel7;

  it("makes the level unique without touching solution cells", () => {
    const before = structuredClone(level);
    const fixed = repairUniqueness(level, makeRng("r"), 60);
    expect(level).toEqual(before);
    expect(fixed).not.toBeNull();
    if (!fixed) return;
    expect(countSolutions(fixed, 5)).toBe(1);
    expect(fixed.solution).toEqual(level.solution);
    level.solution.forEach((c, r) => {
      expect(fixed.regions[r][c]).toBe(level.regions[r][c]);
    });
    expect(validateLevel(fixed)).toEqual([]);
  });

  it("only offers moves that keep every region connected", () => {
    const rng = makeRng("r2");
    let offered = 0;
    const spy: Rng = {
      ...rng,
      pick: <T,>(items: readonly T[]): T => {
        for (const move of items as unknown as { cell: number; to: number }[]) {
          const regions = level.regions.map((row) => [...row]);
          regions[Math.floor(move.cell / 7)][move.cell % 7] = move.to;
          expect(
            validateLevel({ ...level, regions }).filter((i) => i.rule === "region-connected"),
          ).toEqual([]);
          offered++;
        }
        return rng.pick(items);
      },
    };
    repairUniqueness(level, spy, 60);
    expect(offered).toBeGreaterThan(0);
  });

  it("returns null with maxMoves = 0 on a non-unique level", () => {
    expect(repairUniqueness(level, makeRng("z"), 0)).toBeNull();
  });

  it("returns an already-unique level untouched", () => {
    const fixed = repairUniqueness(level, makeRng("r"), 60);
    if (!fixed) throw new Error("repair failed");
    expect(repairUniqueness(fixed, makeRng("q"), 0)).toBe(fixed);
  });
});
