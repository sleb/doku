import type { Level } from "./types";

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
