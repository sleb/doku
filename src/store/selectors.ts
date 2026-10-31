import { type Board, findConflicts, type Level } from "../engine";

/** Flat indices (r * size + c) of every cell involved in a rule conflict. */
export function conflictCells(board: Board, level: Level): ReadonlySet<number> {
  const { size } = level;
  const out = new Set<number>();
  for (const conflict of findConflicts(board, level)) {
    for (const { r, c } of conflict.cells) out.add(r * size + c);
  }
  return out;
}
