import { type Board, Cell, type Coord, type Level } from "./types";

export type ConflictReason = "row" | "col" | "region" | "adjacent";

export interface Conflict {
  reason: ConflictReason;
  cells: Coord[]; // ascending row-major order
}

export function findConflicts(board: Board, level: Level): Conflict[] {
  const n = level.size;
  const rows: Coord[][] = Array.from({ length: n }, () => []);
  const cols: Coord[][] = Array.from({ length: n }, () => []);
  const regions: Coord[][] = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r * n + c] !== Cell.Face) continue;
      rows[r].push({ r, c });
      cols[c].push({ r, c });
      regions[level.regions[r][c]].push({ r, c });
    }
  }
  const groups: [ConflictReason, Coord[][]][] = [
    ["row", rows],
    ["col", cols],
    ["region", regions],
  ];
  const conflicts: Conflict[] = groups.flatMap(([reason, lines]) =>
    lines
      .filter((cells) => cells.length > 1)
      .map((cells) => ({ reason, cells })),
  );
  // Forward neighbors only, so each touching pair is visited once and its
  // cells come out ascending (row-major).
  const forward = [
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r * n + c] !== Cell.Face) continue;
      for (const [dr, dc] of forward) {
        const r2 = r + dr;
        const c2 = c + dc;
        if (r2 >= n || c2 < 0 || c2 >= n) continue;
        if (board[r2 * n + c2] !== Cell.Face) continue;
        conflicts.push({
          reason: "adjacent",
          cells: [
            { r, c },
            { r: r2, c: c2 },
          ],
        });
      }
    }
  }
  return conflicts;
}

export function isSolved(board: Board, level: Level): boolean {
  const n = level.size;
  let faces = 0;
  for (let i = 0; i < n * n; i++) if (board[i] === Cell.Face) faces++;
  if (faces !== n) return false;
  return level.solution.every((c, r) => board[r * n + c] === Cell.Face);
}

export type TapJudgement = "correct" | "wrong";

/**
 * Judges a tap against the level's unique solution. `cell` is a flat
 * row-major index (`r * size + c`), not a row or column. Throws RangeError for
 * anything that is not an integer in `[0, size * size)`: a bad index is a
 * caller bug and must not cost the player a heart.
 */
export function judgeTap(level: Level, cell: number): TapJudgement {
  const n = level.size;
  if (!Number.isInteger(cell) || cell < 0 || cell >= n * n) {
    throw new RangeError(`cell ${cell} is outside 0..${n * n - 1}`);
  }
  return level.solution[Math.floor(cell / n)] === cell % n
    ? "correct"
    : "wrong";
}
