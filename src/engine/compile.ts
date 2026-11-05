import type { Level } from "./types";

export type UnitKind = "row" | "col" | "region";

export interface Unit {
  kind: UnitKind;
  id: number; // row index, column index or region id
  cells: Uint8Array; // member cell indices, ascending
}

// Derived geometry for the technique solver; not serialized. Cells are flat
// indices `r * n + c`. Units are ordered rows, then columns, then regions, so
// the unit index of row r is r, of column c is n + c, of region g is 2n + g.
export interface Puzzle {
  n: number;
  regionOf: Uint8Array;
  units: Unit[];
}

export function compile(level: Level): Puzzle {
  const n = level.size;
  const regionOf = new Uint8Array(n * n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) regionOf[r * n + c] = level.regions[r][c];
  }
  const members: number[][] = Array.from({ length: 3 * n }, () => []);
  for (let i = 0; i < n * n; i++) {
    for (const u of unitIndexes({ n, regionOf }, i)) {
      members[u].push(i);
    }
  }
  const kinds: UnitKind[] = ["row", "col", "region"];
  const units = members.map((cells, k) => ({
    kind: kinds[Math.floor(k / n)],
    id: k % n,
    cells: Uint8Array.from(cells),
  }));
  return { n, regionOf, units };
}

/** Unit indexes of a cell's row, column and region. */
export function unitIndexes(
  p: Pick<Puzzle, "n" | "regionOf">,
  cell: number,
): [number, number, number] {
  const { n } = p;
  return [Math.floor(cell / n), n + (cell % n), 2 * n + p.regionOf[cell]];
}

/** The up to 8 cells touching `cell`, diagonals included. */
export function neighborsOf(p: Pick<Puzzle, "n">, cell: number): number[] {
  const { n } = p;
  const r = Math.floor(cell / n);
  const c = cell % n;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r2 = r + dr;
      const c2 = c + dc;
      if (r2 >= 0 && r2 < n && c2 >= 0 && c2 < n) out.push(r2 * n + c2);
    }
  }
  return out;
}
