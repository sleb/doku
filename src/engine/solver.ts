import { eliminate, fromBoard, placeFace } from "./candidates";
import { compile } from "./compile";
import { type Deduction, TECHNIQUES } from "./techniques";
import type { Board, Level, Tier } from "./types";

// One backtracking search from the rules alone; never reads level.solution.
// Calls onSolution with the live placement (solution[r] = column of row r's
// face) for each complete placement, and stops after `limit` of them. Returns
// how many it found. Assumes a well-formed level (see validateLevel).
function search(
  level: Level,
  limit: number,
  onSolution: (placement: number[]) => void,
): number {
  const { size: n, regions } = level;
  const placement: number[] = [];
  let found = 0;

  const place = (r: number, usedCols: number, usedRegions: number): void => {
    if (r === n) {
      found++;
      onSolution(placement);
      return;
    }
    const prev = r > 0 ? placement[r - 1] : -n;
    for (let c = 0; c < n && found < limit; c++) {
      const region = regions[r][c];
      if ((usedCols >> c) & 1 || (usedRegions >> region) & 1) continue;
      if (Math.abs(c - prev) < 2) continue;
      placement.push(c);
      place(r + 1, usedCols | (1 << c), usedRegions | (1 << region));
      placement.pop();
    }
  };

  if (limit > 0) place(0, 0, 0);
  return found;
}

// Returns the first placement found, or null when none exists.
export function solve(level: Level): number[] | null {
  let first: number[] | null = null;
  search(level, 1, (placement) => {
    first = [...placement];
  });
  return first;
}

// Number of valid placements, stopping once `limit` have been found.
export function countSolutions(level: Level, limit = 2): number {
  return search(level, limit, () => {});
}

// Copies of up to `limit` valid placements, in search order.
export function solutions(level: Level, limit: number): number[][] {
  const found: number[][] = [];
  search(level, limit, (placement) => {
    found.push([...placement]);
  });
  return found;
}

export interface SolveTrace {
  solved: boolean;
  steps: Deduction[]; // in order
  hardest: Tier | null; // highest tier over steps
}

// The human-style solver. Starts from the faces on `board` (marks ignored),
// applies the first deduction of the simplest technique that finds one, then
// restarts from the simplest technique. So `hardest` is the lowest tier at
// which the level can be solved by this ladder. Never reads level.solution.
export function solveByTechniques(level: Level, board?: Board): SolveTrace {
  const p = compile(level);
  const isDone = (placed: Uint8Array) =>
    placed.reduce((sum, v) => sum + v, 0) === p.n;
  let cand = fromBoard(p, board);
  const steps: Deduction[] = [];
  let hardest: Tier | null = null;
  const tiers = TECHNIQUES.map((t) => t.tier);
  for (;;) {
    if (isDone(cand.placed)) break;
    let step: Deduction | null = null;
    for (const t of TECHNIQUES) {
      step = t.run(p, cand);
      if (step) break;
    }
    if (!step) break;
    steps.push(step);
    if (!hardest || tiers.indexOf(step.tier) > tiers.indexOf(hardest)) {
      hardest = step.tier;
    }
    cand =
      step.place !== undefined
        ? placeFace(p, cand, step.place)
        : eliminate(p, cand, step.eliminate);
  }
  return { solved: isDone(cand.placed), steps, hardest };
}
