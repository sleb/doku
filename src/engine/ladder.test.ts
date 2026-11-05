import { describe, expect, it } from "vitest";
import { uniqueLevel7, uniqueLevel11 } from "./__fixtures__/levels";
import { eliminate, fromBoard, placeFace } from "./candidates";
import { compile } from "./compile";
import { generate } from "./generator";
import { solveByTechniques } from "./solver";
import { TECHNIQUES } from "./techniques";
import { Cell, type Level } from "./types";

const SIZES = [7, 8, 9, 10, 11];
const SEEDS = 20;

const generated: Level[] = SIZES.flatMap((size) =>
  Array.from({ length: SEEDS }, (_, i) => {
    const level = generate({ size, seed: `ladder/${size}/${i}` });
    if (!level) throw new Error(`no level for ${size}/${i}`);
    return level;
  }),
);

const placements = (level: Level, steps: { place?: number }[]) =>
  steps
    .flatMap((s) => (s.place === undefined ? [] : [s.place]))
    .sort((a, b) => a - b)
    .map((i) => [Math.floor(i / level.size), i % level.size]);

describe("solveByTechniques", () => {
  it("returns solved traces whose placements are the stored solution", () => {
    let solved = 0;
    for (const level of [uniqueLevel7, uniqueLevel11, ...generated]) {
      const trace = solveByTechniques(level);
      if (!trace.solved) continue;
      solved++;
      expect(placements(level, trace.steps)).toEqual(
        level.solution.map((c, r) => [r, c]),
      );
    }
    expect(solved).toBeGreaterThan(10);
  });

  it("is sound: no step removes a solution cell, every place is one", () => {
    for (const level of generated) {
      const n = level.size;
      const inSolution = (i: number) =>
        level.solution[Math.floor(i / n)] === i % n;
      for (const step of solveByTechniques(level).steps) {
        if (step.place !== undefined) expect(inSolution(step.place)).toBe(true);
        for (const i of step.eliminate) expect(inSolution(i)).toBe(false);
      }
    }
  }, 120_000);

  it("always applies the simplest applicable technique", () => {
    for (const level of generated.slice(0, 40)) {
      const p = compile(level);
      let cand = fromBoard(p);
      for (const step of solveByTechniques(level).steps) {
        const rank = TECHNIQUES.findIndex((t) => t.id === step.technique);
        for (const t of TECHNIQUES.slice(0, rank)) {
          expect(t.run(p, cand)).toBeNull();
        }
        cand =
          step.place !== undefined
            ? placeFace(p, cand, step.place)
            : eliminate(p, cand, step.eliminate);
      }
    }
  });

  it("reports the hardest tier used, or null with no steps", () => {
    const trace = solveByTechniques(uniqueLevel7);
    const tiers = trace.steps.map((s) => s.tier);
    const order = ["easy", "medium", "hard"] as const;
    const hardest = order.filter((t) => tiers.includes(t)).pop() ?? null;
    expect(trace.hardest).toBe(hardest);

    const n = uniqueLevel7.size;
    const full = new Uint8Array(n * n);
    uniqueLevel7.solution.forEach((c, r) => {
      full[r * n + c] = Cell.Face;
    });
    expect(solveByTechniques(uniqueLevel7, full)).toEqual({
      solved: true,
      steps: [],
      hardest: null,
    });
  });

  it("starts from the faces on the board and ignores marks", () => {
    const level = generated[0];
    const n = level.size;
    const board = new Uint8Array(n * n);
    board[level.solution[0]] = Cell.Face;
    const marked = new Uint8Array(board);
    for (let i = 0; i < n * n; i++)
      if (!marked[i] && i % 3 === 0) marked[i] = Cell.Mark;
    expect(solveByTechniques(level, marked)).toEqual(
      solveByTechniques(level, board),
    );
    const empty = solveByTechniques(level);
    const partial = solveByTechniques(level, board);
    expect(partial.steps.length).toBeLessThanOrEqual(empty.steps.length);
  });

  it("reports solved:false when the ladder is stuck", () => {
    const stuck = generated.find((l) => !solveByTechniques(l).solved);
    expect(stuck).toBeDefined();
    const trace = solveByTechniques(stuck as Level);
    expect(trace.solved).toBe(false);
    expect(
      trace.hardest === null ||
        ["easy", "medium", "hard"].includes(trace.hardest),
    ).toBe(true);
  });

  it("is sound on hard levels, and their hard steps never touch placed cells", () => {
    let hardSteps = 0;
    for (const size of [7, 8, 9]) {
      for (let i = 0; i < 6; i++) {
        const level = generate({
          size,
          tier: "hard",
          seed: `soundhard/${size}/${i}`,
        });
        if (!level) continue;
        const inSolution = (c: number) =>
          level.solution[Math.floor(c / size)] === c % size;
        for (const step of solveByTechniques(level).steps) {
          if (step.place !== undefined)
            expect(inSolution(step.place)).toBe(true);
          for (const c of step.eliminate) expect(inSolution(c)).toBe(false);
          if (step.tier === "hard") hardSteps++;
        }
      }
    }
    expect(hardSteps).toBeGreaterThan(0);
  }, 120_000);
});
