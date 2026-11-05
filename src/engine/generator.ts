import type { Rng } from "./seed";

export interface ShapeLimits {
  /** Smallest size of any region beyond the allowed singletons. */
  minRegion: number;
  /** One-cell regions allowed. */
  maxSingletons: number;
  /** Largest region size. */
  maxRegion: number;
}

export function defaultShape(n: number): ShapeLimits {
  return {
    minRegion: 2,
    maxSingletons: n <= 8 ? 1 : 2,
    maxRegion: Math.ceil(0.35 * n * n),
  };
}

/** Row-by-row backtracking over shuffled column order; spaced permutation. */
export function randomSolution(n: number, rng: Rng): number[] {
  const placement: number[] = [];
  const place = (r: number, used: number): boolean => {
    if (r === n) return true;
    const prev = r > 0 ? placement[r - 1] : -n;
    for (const c of rng.shuffle(Array.from({ length: n }, (_, i) => i))) {
      if ((used >> c) & 1 || Math.abs(c - prev) < 2) continue;
      placement.push(c);
      if (place(r + 1, used | (1 << c))) return true;
      placement.pop();
    }
    return false;
  };
  place(0, 0);
  return placement;
}

/** Region sizes within limits; regions are ids 0..n-1 over an n x n grid. */
export function passesShape(regions: number[][], shape: ShapeLimits): boolean {
  const sizes = Array<number>(regions.length).fill(0);
  for (const row of regions) for (const id of row) sizes[id]++;
  let singletons = 0;
  for (const size of sizes) {
    if (size === 1) {
      singletons++;
      if (singletons > shape.maxSingletons) return false;
    } else if (size < shape.minRegion || size > shape.maxRegion) {
      return false;
    }
  }
  return true;
}
