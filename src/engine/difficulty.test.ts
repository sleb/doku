import { describe, expect, it } from "vitest";
import { uniqueLevel7 } from "./__fixtures__/levels";
import { rate } from "./difficulty";
import { generate } from "./generator";
import { solveByTechniques } from "./solver";

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
