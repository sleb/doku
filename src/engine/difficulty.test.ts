import { describe, expect, it } from "vitest";
import { uniqueLevel7 } from "./__fixtures__/levels";
import { mediumLevel11, rated } from "./__fixtures__/rated";
import { rate } from "./difficulty";
import { generate } from "./generator";
import { solveByTechniques } from "./solver";

describe("rate goldens", () => {
  it.each(rated)("$name is $tier", ({ level, tier }) => {
    expect(rate(level)).toBe(tier);
  });

  it("easy levels need only single-candidate, medium at least one medium step", () => {
    for (const { level, tier } of rated) {
      const steps = solveByTechniques(level).steps;
      if (tier === "easy") {
        expect(steps.every((s) => s.technique === "single-candidate")).toBe(
          true,
        );
      }
      if (tier === "medium") {
        expect(steps.some((s) => s.tier === "medium")).toBe(true);
      }
    }
  });

  it("unrated levels stall before every unit is satisfied", () => {
    for (const { level, tier } of rated.filter((g) => g.tier === "unrated")) {
      expect(solveByTechniques(level).solved, level.id).toBe(false);
      expect(tier).toBe("unrated");
    }
  });
});

describe("rate", () => {
  it("agrees with the technique trace", () => {
    for (let i = 0; i < 30; i++) {
      const level = generate({ size: 7, seed: `rate/${i}` });
      if (!level) throw new Error("no level");
      const trace = solveByTechniques(level);
      expect(rate(level)).toBe(trace.solved ? trace.hardest : "unrated");
    }
  });

  it("rates a level the ladder cannot finish as unrated", () => {
    const stuck = Array.from({ length: 30 }, (_, i) =>
      generate({ size: 7, seed: `rate/${i}` }),
    ).find((l) => l && !solveByTechniques(l).solved);
    expect(stuck).toBeTruthy();
    expect(rate(stuck as NonNullable<typeof stuck>)).toBe("unrated");
  });

  it("returns a tier or unrated for a fixture", () => {
    expect(["easy", "medium", "unrated"]).toContain(rate(uniqueLevel7));
  });
});

describe("rate performance", () => {
  it("the 11x11 fixture is solved by the ladder", () => {
    expect(rate(mediumLevel11)).toBe("medium");
  });

  it("rates an 11x11 level in under 10 ms (median of warmed runs)", () => {
    for (let i = 0; i < 20; i++) rate(mediumLevel11);
    const times: number[] = [];
    for (let i = 0; i < 21; i++) {
      const start = performance.now();
      rate(mediumLevel11);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    expect(times[10]).toBeLessThan(10);
  });
});
