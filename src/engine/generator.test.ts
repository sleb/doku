import { describe, expect, it, vi } from "vitest";
import { multiSolutionLevel7 } from "./__fixtures__/levels";
import * as difficulty from "./difficulty";
import { rate } from "./difficulty";
import {
  defaultShape,
  generate,
  generateCandidate,
  growRegions,
  passesShape,
  randomSolution,
  repairUniqueness,
  tryCandidate,
} from "./generator";
import { makeRng, type Rng } from "./seed";
import { countSolutions, solve } from "./solver";
import type { Level } from "./types";
import { validateLevel } from "./validate";

const SIZES = [7, 8, 9, 10, 11];
// A seed whose first attempt (#0) fails; found by scanning.
const NEEDS_RETRY = "retry";

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
  // The fixture has 646 placements, so few seeds converge within 60 moves;
  // this one was found by scanning.
  const REPAIR_SEED = "r81";

  it("makes the level unique without touching solution cells", () => {
    const before = structuredClone(level);
    const fixed = repairUniqueness(level, makeRng(REPAIR_SEED), 60);
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
    const rng = makeRng(REPAIR_SEED);
    let offered = 0;
    const current = level.regions.map((row) => [...row]);
    const spy: Rng = {
      ...rng,
      pick: <T>(items: readonly T[]): T => {
        const moves = items as unknown as { cell: number; to: number }[];
        for (const move of moves) {
          const regions = current.map((row) => [...row]);
          regions[Math.floor(move.cell / 7)][move.cell % 7] = move.to;
          expect(
            validateLevel({ ...level, regions }).filter(
              (i) => i.rule === "region-connected",
            ),
          ).toEqual([]);
          offered++;
        }
        const chosen = rng.pick(moves);
        current[Math.floor(chosen.cell / 7)][chosen.cell % 7] = chosen.to;
        return chosen as unknown as T;
      },
    };
    repairUniqueness(level, spy, 60);
    expect(offered).toBeGreaterThan(0);
  });

  it("returns null with maxMoves = 0 on a non-unique level", () => {
    expect(repairUniqueness(level, makeRng("z"), 0)).toBeNull();
  });

  it("returns an already-unique level untouched", () => {
    const fixed = repairUniqueness(level, makeRng(REPAIR_SEED), 60);
    if (!fixed) throw new Error("repair failed");
    expect(repairUniqueness(fixed, makeRng("q"), 0)).toBe(fixed);
  });
});

describe("generateCandidate", () => {
  it("returns null or a valid, uniquely solvable level", () => {
    let made = 0;
    for (let s = 0; s < 20; s++) {
      const level = generateCandidate(8, makeRng(`c${s}`));
      if (!level) continue;
      made++;
      expect(validateLevel(level)).toEqual([]);
      expect(countSolutions(level, 5)).toBe(1);
      expect(solve(level)).toEqual(level.solution);
      expect(passesShape(level.regions, defaultShape(8))).toBe(true);
    }
    expect(made).toBeGreaterThan(0);
  });
});

describe("generate", () => {
  it.each(SIZES)(
    "is valid and unique for n=%i over 25 seeds",
    (size) => {
      for (let s = 0; s < 25; s++) {
        const level = generate({ size, seed: `p${s}` });
        expect(level).not.toBeNull();
        if (!level) continue;
        expect(validateLevel(level)).toEqual([]);
        expect(countSolutions(level)).toBe(1);
        expect(solve(level)).toEqual(level.solution);
      }
    },
    60_000,
  );

  it("is deterministic and reproducible from level.seed", () => {
    const a = generate({ size: 8, seed: "det" });
    expect(a).toEqual(generate({ size: 8, seed: "det" }));
    if (!a) throw new Error("no level");
    expect(a.id).toBe(a.seed);
    expect(a.seed).toMatch(/^det#\d+$/);
    const candidate = generateCandidate(8, makeRng(a.seed as string));
    expect(candidate).toEqual({ ...a, id: "", seed: undefined });
  });

  it("returns null when the attempt budget is spent", () => {
    expect(
      generate({ size: 11, seed: NEEDS_RETRY, maxAttempts: 1 }),
    ).toBeNull();
    expect(generate({ size: 11, seed: NEEDS_RETRY })).not.toBeNull();
  });

  it("returns null for a pre-aborted signal", () => {
    const signal = AbortSignal.abort();
    expect(generate({ size: 7, seed: "x", signal })).toBeNull();
  });

  it.each([6, 12, 7.5, Number.NaN])("throws RangeError for size %s", (size) => {
    expect(() => generate({ size, seed: "x" })).toThrow(RangeError);
  });

  it("does not mutate its options", () => {
    const shape = Object.freeze({ maxSingletons: 2 });
    const options = Object.freeze({ size: 7, seed: "imm", shape });
    expect(() => generate(options)).not.toThrow();
  });

  it("matches the golden 7x7 level", () => {
    expect(generate({ size: 7, seed: "golden" })).toMatchInlineSnapshot(`
      {
        "id": "golden#1",
        "regions": [
          [
            0,
            0,
            0,
            1,
            1,
            1,
            1,
          ],
          [
            0,
            0,
            1,
            1,
            2,
            1,
            2,
          ],
          [
            0,
            0,
            0,
            1,
            2,
            2,
            2,
          ],
          [
            3,
            3,
            3,
            1,
            2,
            2,
            5,
          ],
          [
            3,
            3,
            3,
            4,
            6,
            2,
            5,
          ],
          [
            3,
            3,
            3,
            6,
            6,
            5,
            5,
          ],
          [
            3,
            3,
            3,
            6,
            6,
            5,
            5,
          ],
        ],
        "seed": "golden#1",
        "size": 7,
        "solution": [
          0,
          2,
          5,
          1,
          3,
          6,
          4,
        ],
      }
    `);
  });
});

describe("generate with a tier", () => {
  it.each(["easy", "medium"] as const)(
    "returns unique %s levels at 7x7 over 10 seeds",
    (tier) => {
      for (let s = 0; s < 10; s++) {
        const level = generate({ size: 7, tier, seed: `tier${s}` });
        expect(level, `seed ${s}`).not.toBeNull();
        if (!level) continue;
        expect(rate(level)).toBe(tier);
        expect(level.tier).toBe(tier);
        expect(countSolutions(level)).toBe(1);
      }
    },
    60_000,
  );

  it("is deterministic", () => {
    expect(generate({ size: 7, tier: "medium", seed: "d" })).toEqual(
      generate({ size: 7, tier: "medium", seed: "d" }),
    );
  });

  it("never calls rate without a tier, and does when tiered", () => {
    const spy = vi.spyOn(difficulty, "rate");
    generate({ size: 7, seed: "spy" });
    expect(spy).not.toHaveBeenCalled();
    generate({ size: 7, tier: "easy", seed: "spy" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns null for a tier it cannot fill within the budget", () => {
    expect(
      generate({ size: 7, tier: "hard", seed: "h", maxAttempts: 20 }),
    ).toBeNull();
  });
});

describe("tryCandidate", () => {
  const reasons = (shape?: Parameters<typeof tryCandidate>[2]) =>
    new Set(
      Array.from({ length: 100 }, (_, k) =>
        tryCandidate(7, makeRng(`t${k}`), shape),
      ).flatMap((r) => ("reject" in r ? [r.reject] : [])),
    );

  it("reports a failed repair", () => {
    expect(reasons().has("repair")).toBe(true);
  });

  it("reports a failed shape filter", () => {
    expect(reasons({ maxRegion: 8 }).has("shape")).toBe(true);
  });

  it("reports tier and unrated rejects only when a tier is asked for", () => {
    const seen = new Set<string>();
    for (let k = 0; k < 60; k++) {
      const r = tryCandidate(7, makeRng(`t${k}`), undefined, "easy");
      if ("reject" in r) seen.add(r.reject);
      else expect(r.level.tier).toBe("easy");
    }
    expect(seen.has("tier")).toBe(true);
    expect(reasons().has("tier")).toBe(false);
    expect(reasons().has("unrated")).toBe(false);
  });

  it("agrees with generateCandidate", () => {
    for (let k = 0; k < 40; k++) {
      const r = tryCandidate(7, makeRng(`t${k}`));
      expect(generateCandidate(7, makeRng(`t${k}`))).toEqual(
        "level" in r ? r.level : null,
      );
    }
  });
});
