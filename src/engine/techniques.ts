import type { Candidates } from "./candidates";
import type { Puzzle, UnitKind } from "./compile";
import type { Tier } from "./types";

export type TechniqueId =
  | "single-candidate"
  | "region-in-line"
  | "line-in-region";

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

// Ordered simplest to hardest; the single source of truth for tier.
export const TECHNIQUES: { id: TechniqueId; tier: Tier; run: Technique }[] = [
  { id: "single-candidate", tier: "easy", run: singleCandidate },
  { id: "region-in-line", tier: "medium", run: regionInLine },
  { id: "line-in-region", tier: "medium", run: lineInRegion },
];
