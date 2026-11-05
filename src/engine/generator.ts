import { makeRng, type Rng } from "./seed";
import { solutions } from "./solver";
import type { Level } from "./types";
import { MAX_SIZE, MIN_SIZE } from "./validate";

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

// Rivals examined per repair move.
const RIVALS = 8;

interface Move {
  cell: number;
  to: number;
}

// True when region `id` is non-empty and 4-connected ignoring `skip`.
function connectedWithout(
  grid: readonly number[],
  n: number,
  id: number,
  skip: number,
): boolean {
  const cells: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === id && i !== skip) cells.push(i);
  }
  if (cells.length === 0) return false;
  const seen = new Set<number>([cells[0]]);
  const stack = [cells[0]];
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    const r = Math.floor(cur / n);
    const c = cur % n;
    for (const [dr, dc] of DIRS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      const nb = rr * n + cc;
      if (nb !== skip && grid[nb] === id && !seen.has(nb)) {
        seen.add(nb);
        stack.push(nb);
      }
    }
  }
  return seen.size === cells.length;
}

// Breaks rival solutions one at a time by moving a rival's face cell into a
// neighbouring region. The moved cell is never a solution cell, so the stored
// solution stays valid. Returns the level itself when already unique, null
// when no move helps or the budget runs out.
export function repairUniqueness(
  level: Level,
  rng: Rng,
  maxMoves: number,
): Level | null {
  const n = level.size;
  let current = level;
  for (let move = 0; ; move++) {
    // Rivals beyond the first widen the choice of movable cells: a rival whose
    // faces all sit mid-region cannot be broken by itself.
    const found = solutions(current, RIVALS);
    if (found.length === 1) return current;
    if (found.length === 0 || move >= maxMoves) return null;

    const grid = current.regions.flat();
    const moves: Move[] = [];
    const seen = new Set<string>();
    for (const rival of found) {
      rival.forEach((c, r) => {
        if (c === level.solution[r]) return;
        const cell = r * n + c;
        const from = grid[cell];
        if (!connectedWithout(grid, n, from, cell)) return;
        const targets = new Set<number>();
        for (const [dr, dc] of DIRS) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
          const to = grid[rr * n + cc];
          if (to !== from) targets.add(to);
        }
        for (const to of [...targets].sort((x, y) => x - y)) {
          if (seen.has(`${cell}:${to}`)) continue;
          seen.add(`${cell}:${to}`);
          moves.push({ cell, to });
        }
      });
    }
    if (moves.length === 0) return null;

    const chosen = rng.pick(moves);
    const regions = current.regions.map((row) => [...row]);
    regions[Math.floor(chosen.cell / n)][chosen.cell % n] = chosen.to;
    current = { ...current, regions };
  }
}

// Repair moves allowed per candidate.
const MAX_MOVES = 60;
const DEFAULT_MAX_ATTEMPTS = 2000;

export interface GenerateOptions {
  size: number;
  seed: string;
  /** Attempts before giving up; the only budget, so results never depend on time. */
  maxAttempts?: number;
  shape?: Partial<ShapeLimits>;
  /** Checked once per attempt; abort returns null. */
  signal?: AbortSignal;
}

// One attempt: solution, regions, uniqueness repair, shape filter. The result
// has an empty id and no seed; generate() fills those in.
export function generateCandidate(
  size: number,
  rng: Rng,
  shape?: Partial<ShapeLimits>,
): Level | null {
  const limits = { ...defaultShape(size), ...shape };
  const solution = randomSolution(size, rng);
  const regions = growRegions(size, solution, rng, limits);
  const repaired = repairUniqueness(
    { id: "", size, regions, solution },
    rng,
    MAX_MOVES,
  );
  if (!repaired || !passesShape(repaired.regions, limits)) return null;
  return repaired;
}

// Runs attempts `${seed}#0`, `${seed}#1`, ... and returns the first candidate
// that survives. id and seed are both the attempt seed, so
// generateCandidate(size, makeRng(level.seed)) reproduces the level.
export function generate(options: GenerateOptions): Level | null {
  const { size, seed, shape, signal } = options;
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(
      `size must be an integer in ${MIN_SIZE}..${MAX_SIZE}, got ${size}`,
    );
  }
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  for (let k = 0; k < maxAttempts; k++) {
    if (signal?.aborted) return null;
    const attemptSeed = `${seed}#${k}`;
    const candidate = generateCandidate(size, makeRng(attemptSeed), shape);
    if (candidate) return { ...candidate, id: attemptSeed, seed: attemptSeed };
  }
  return null;
}
