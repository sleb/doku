import { type Board, Cell, type Coord, type Level } from "./types";

export type ConflictReason = "row" | "col";

export interface Conflict {
  reason: ConflictReason;
  cells: Coord[]; // ascending order
}

export function findConflicts(board: Board, level: Level): Conflict[] {
  const n = level.size;
  const rows: Coord[][] = Array.from({ length: n }, () => []);
  const cols: Coord[][] = Array.from({ length: n }, () => []);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r * n + c] !== Cell.Face) continue;
      rows[r].push({ r, c });
      cols[c].push({ r, c });
    }
  }
  const groups: [ConflictReason, Coord[][]][] = [
    ["row", rows],
    ["col", cols],
  ];
  return groups.flatMap(([reason, lines]) =>
    lines
      .filter((cells) => cells.length > 1)
      .map((cells) => ({ reason, cells })),
  );
}
