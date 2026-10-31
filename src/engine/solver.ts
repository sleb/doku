import type { Level } from "./types";

// Backtracking search from the rules alone; never reads level.solution.
// Returns the first placement found (solution[r] = column of row r's face), or
// null when none exists. Assumes a well-formed level (see validateLevel).
export function solve(level: Level): number[] | null {
  const { size: n, regions } = level;
  const placement: number[] = [];

  const place = (r: number, usedCols: number, usedRegions: number): boolean => {
    if (r === n) return true;
    const prev = r > 0 ? placement[r - 1] : -n;
    for (let c = 0; c < n; c++) {
      const region = regions[r][c];
      if ((usedCols >> c) & 1 || (usedRegions >> region) & 1) continue;
      if (Math.abs(c - prev) < 2) continue;
      placement.push(c);
      if (place(r + 1, usedCols | (1 << c), usedRegions | (1 << region))) {
        return true;
      }
      placement.pop();
    }
    return false;
  };

  return place(0, 0, 0) ? placement : null;
}
