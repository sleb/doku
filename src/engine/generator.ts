import type { Rng } from "./seed";
import { solutions } from "./solver";
import type { Level } from "./types";

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

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// Region r grows around the solution cell of row r. Sizes are targeted first
// (a few singletons, the rest in [minRegion, maxRegion]) and cells are then
// added one at a time to a region chosen in proportion to its remaining target.
export function growRegions(
  n: number,
  solution: readonly number[],
  rng: Rng,
  shape: ShapeLimits,
): number[][] {
  const owner = Array<number>(n * n).fill(-1);
  const frontier: number[][] = Array.from({ length: n }, () => []);
  const size = Array<number>(n).fill(0);

  const neighbours = (cell: number): number[] => {
    const r = Math.floor(cell / n);
    const c = cell % n;
    const out: number[] = [];
    for (const [dr, dc] of DIRS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.push(rr * n + cc);
    }
    return out;
  };
  const assign = (cell: number, region: number): void => {
    owner[cell] = region;
    size[region]++;
    for (const nb of neighbours(cell)) {
      if (owner[nb] === -1) frontier[region].push(nb);
    }
  };

  // Targets: k singletons, the rest minRegion plus a random share of the spare.
  const singletons = rng.int(shape.maxSingletons + 1);
  const target = Array<number>(n).fill(shape.minRegion);
  const order = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  for (let i = 0; i < singletons; i++) target[order[i]] = 1;
  let spare = n * n - target.reduce((a, b) => a + b, 0);
  const growable = order.slice(singletons);
  while (spare > 0 && growable.length > 0) {
    const open = growable.filter((i) => target[i] < shape.maxRegion);
    if (open.length === 0) break;
    target[rng.pick(open)]++;
    spare--;
  }

  solution.forEach((c, r) => {
    assign(r * n + c, r);
  });

  for (let step = 0; step < n * n - n; step++) {
    for (const f of frontier) {
      for (let i = f.length - 1; i >= 0; i--) {
        if (owner[f[i]] !== -1) f.splice(i, 1);
      }
    }
    const weights = frontier.map((f, i) =>
      f.length > 0 && size[i] < target[i] ? target[i] - size[i] : 0,
    );
    const total = weights.reduce((a, b) => a + b, 0);
    let region: number;
    if (total > 0) {
      let roll = rng.int(total);
      region = weights.findIndex((w) => {
        roll -= w;
        return w > 0 && roll < 0;
      });
    } else {
      const open = frontier.flatMap((f, i) => (f.length > 0 ? [i] : []));
      if (open.length === 0) break;
      region = rng.pick(open);
    }
    assign(rng.pick(frontier[region]), region);
  }

  return Array.from({ length: n }, (_, r) => owner.slice(r * n, r * n + n));
}
