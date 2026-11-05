import {
  type Candidates,
  eliminate,
  emptiedUnit,
  placeFace,
} from "./candidates";
import { neighborsOf, type Puzzle, type UnitKind } from "./compile";
import type { Tier } from "./types";

export type TechniqueId =
  | "single-candidate"
  | "region-in-line"
  | "line-in-region"
  | "adjacency-pressure"
  | "subset-regions-lines"
  | "subset-lines-regions"
  | "lookahead";

export interface UnitRef {
  kind: UnitKind;
  id: number;
}

export interface Deduction {
  technique: TechniqueId;
  tier: Tier;
  place?: number; // a cell that must hold a face, or
  eliminate: number[]; // cells that cannot (non-empty when there is no place)
  because: { units: UnitRef[]; cells: number[] };
}

export type Technique = (p: Puzzle, c: Candidates) => Deduction | null;

const ref = (p: Puzzle, unit: number): UnitRef => ({
  kind: p.units[unit].kind,
  id: p.units[unit].id,
});

const aliveCells = (p: Puzzle, c: Candidates, unit: number): number[] =>
  Array.from(p.units[unit].cells).filter((i) => c.alive[i]);

// An unsatisfied unit with exactly one alive cell holds its face there.
export const singleCandidate: Technique = (p, c) => {
  for (let u = 0; u < p.units.length; u++) {
    if (c.satisfied[u] || c.aliveCount[u] !== 1) continue;
    const [cell] = aliveCells(p, c, u);
    return {
      technique: "single-candidate",
      tier: "easy",
      place: cell,
      eliminate: [],
      because: { units: [ref(p, u)], cells: [cell] },
    };
  }
  return null;
};

// Unit index of the row (or column) that all of `cells` share, or -1.
function sharedLine(p: Puzzle, cells: number[], kind: "row" | "col"): number {
  const of = (i: number) => (kind === "row" ? Math.floor(i / p.n) : i % p.n);
  const line = of(cells[0]);
  if (!cells.every((i) => of(i) === line)) return -1;
  return kind === "row" ? line : p.n + line;
}

// All alive cells of a region lie in one line: that line's face is in the
// region, so the line's other alive cells go.
export const regionInLine: Technique = (p, c) => {
  for (let u = 2 * p.n; u < 3 * p.n; u++) {
    if (c.satisfied[u]) continue;
    const cells = aliveCells(p, c, u);
    if (cells.length === 0) continue;
    for (const kind of ["row", "col"] as const) {
      const line = sharedLine(p, cells, kind);
      if (line < 0 || c.satisfied[line]) continue;
      const out = aliveCells(p, c, line).filter(
        (i) => p.regionOf[i] !== p.units[u].id && !c.placed[i],
      );
      if (out.length === 0) continue;
      return {
        technique: "region-in-line",
        tier: "medium",
        eliminate: out,
        because: { units: [ref(p, u), ref(p, line)], cells },
      };
    }
  }
  return null;
};

// Converse: all alive cells of a line lie in one region, so the region's other
// alive cells go.
export const lineInRegion: Technique = (p, c) => {
  for (let u = 0; u < 2 * p.n; u++) {
    if (c.satisfied[u]) continue;
    const cells = aliveCells(p, c, u);
    if (cells.length === 0) continue;
    const region = p.regionOf[cells[0]];
    if (!cells.every((i) => p.regionOf[i] === region)) continue;
    const unit = 2 * p.n + region;
    if (c.satisfied[unit]) continue;
    const out = aliveCells(p, c, unit).filter(
      (i) => !cells.includes(i) && !c.placed[i],
    );
    if (out.length === 0) continue;
    return {
      technique: "line-in-region",
      tier: "medium",
      eliminate: out,
      because: { units: [ref(p, u), ref(p, unit)], cells },
    };
  }
  return null;
};

// If a face at X would leave some other unsatisfied unit with no alive cell,
// X is impossible. Checked without cloning: the cells a face at X removes are
// exactly its row, column, region and neighbors.
export const adjacencyPressure: Technique = (p, c) => {
  const covered = new Uint8Array(p.n * p.n);
  for (let x = 0; x < p.n * p.n; x++) {
    if (!c.alive[x] || c.placed[x]) continue;
    covered.fill(0);
    for (const u of [
      Math.floor(x / p.n),
      p.n + (x % p.n),
      2 * p.n + p.regionOf[x],
    ]) {
      for (const cell of p.units[u].cells) covered[cell] = 1;
    }
    for (const cell of neighborsOf(p, x)) covered[cell] = 1;
    for (let u = 0; u < p.units.length; u++) {
      if (c.satisfied[u] || c.aliveCount[u] === 0) continue;
      const cells = aliveCells(p, c, u);
      if (cells.includes(x) || !cells.every((i) => covered[i])) continue;
      return {
        technique: "adjacency-pressure",
        tier: "hard",
        eliminate: [x],
        because: { units: [ref(p, u)], cells },
      };
    }
  }
  return null;
};

// Calls `visit` with each subset of `items` of exactly `size` members whose
// merged bitmask has `size` bits, stopping at the first truthy result.
function tightSubset<T>(
  items: { id: number; mask: number }[],
  size: number,
  visit: (ids: number[], mask: number) => T | null,
): T | null {
  const pick = (start: number, ids: number[], mask: number): T | null => {
    if (popcount(mask) > size) return null;
    if (ids.length === size)
      return popcount(mask) === size ? visit(ids, mask) : null;
    for (let k = start; k < items.length; k++) {
      const found = pick(k + 1, [...ids, items[k].id], mask | items[k].mask);
      if (found) return found;
    }
    return null;
  };
  return pick(0, [], 0);
}

function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

// M units of one kind (A) that between them touch only M units of the other
// kind (B) own those B units: every other alive cell of the B units goes. A is
// regions and B is rows or columns, or the reverse.
function subset(
  p: Puzzle,
  c: Candidates,
  technique: "subset-regions-lines" | "subset-lines-regions",
): Deduction | null {
  const n = p.n;
  const regionsFirst = technique === "subset-regions-lines";
  for (const lineBase of [0, n]) {
    const aBase = regionsFirst ? 2 * n : lineBase;
    const bBase = regionsFirst ? lineBase : 2 * n;
    const bOf = (cell: number) =>
      regionsFirst
        ? lineBase === 0
          ? Math.floor(cell / n)
          : cell % n
        : p.regionOf[cell];
    const aOf = (cell: number) =>
      regionsFirst
        ? p.regionOf[cell]
        : lineBase === 0
          ? Math.floor(cell / n)
          : cell % n;
    const items: { id: number; mask: number }[] = [];
    for (let a = 0; a < n; a++) {
      if (c.satisfied[aBase + a]) continue;
      let mask = 0;
      for (const cell of aliveCells(p, c, aBase + a)) mask |= 1 << bOf(cell);
      if (mask) items.push({ id: a, mask });
    }
    for (let size = 2; size <= Math.floor(n / 2); size++) {
      const found = tightSubset(items, size, (ids, mask) => {
        const bs = Array.from({ length: n }, (_, b) => b).filter(
          (b) => (mask >> b) & 1,
        );
        const out = bs
          .flatMap((b) => aliveCells(p, c, bBase + b))
          .filter((i) => !ids.includes(aOf(i)) && !c.placed[i]);
        if (out.length === 0) return null;
        const cells = ids.flatMap((a) => aliveCells(p, c, aBase + a));
        return {
          technique,
          tier: "hard" as const,
          eliminate: out,
          because: {
            units: [
              ...ids.map((a) => ref(p, aBase + a)),
              ...bs.map((b) => ref(p, bBase + b)),
            ],
            cells,
          },
        };
      });
      if (found) return found;
    }
  }
  return null;
}

export const subsetRegionsLines: Technique = (p, c) =>
  subset(p, c, "subset-regions-lines");

export const subsetLinesRegions: Technique = (p, c) =>
  subset(p, c, "subset-lines-regions");

// Applies a deduction, returning new candidates.
export function applyDeduction(
  p: Puzzle,
  c: Candidates,
  d: Deduction,
): Candidates {
  return d.place !== undefined
    ? placeFace(p, c, d.place)
    : eliminate(p, c, d.eliminate);
}

// Rungs 1 to 6 (every technique below lookahead) to a fixpoint, stopping early
// when a unit empties. Lookahead's inner loop; depth 1, so it never nests.
export function propagate(p: Puzzle, c: Candidates): Candidates {
  let cand = c;
  for (;;) {
    if (emptiedUnit(cand) >= 0) return cand;
    let step: Deduction | null = null;
    for (const t of TECHNIQUES) {
      if (t.id === "lookahead") break;
      step = t.run(p, cand);
      if (step) break;
    }
    if (!step) return cand;
    cand = applyDeduction(p, cand, step);
  }
}

// Assume a face at X and propagate with rungs 1 to 6. If some unit empties, X
// is impossible. The first such cell in index order, one per call; always an
// elimination, never a placement. Cites the unit that emptied.
export const lookahead: Technique = (p, c) => {
  for (let x = 0; x < p.n * p.n; x++) {
    if (!c.alive[x] || c.placed[x]) continue;
    const unit = emptiedUnit(propagate(p, placeFace(p, c, x)));
    if (unit < 0) continue;
    return {
      technique: "lookahead",
      tier: "expert",
      eliminate: [x],
      because: { units: [ref(p, unit)], cells: [x] },
    };
  }
  return null;
};

// Ordered simplest to hardest; the single source of truth for tier.
export const TECHNIQUES: { id: TechniqueId; tier: Tier; run: Technique }[] = [
  { id: "single-candidate", tier: "easy", run: singleCandidate },
  { id: "region-in-line", tier: "medium", run: regionInLine },
  { id: "line-in-region", tier: "medium", run: lineInRegion },
  { id: "adjacency-pressure", tier: "hard", run: adjacencyPressure },
  { id: "subset-regions-lines", tier: "hard", run: subsetRegionsLines },
  { id: "subset-lines-regions", tier: "hard", run: subsetLinesRegions },
  { id: "lookahead", tier: "expert", run: lookahead },
];
