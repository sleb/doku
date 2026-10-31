import { findConflicts } from "../engine";
import type { GameState } from "./game";

/** Flat indices (r * size + c) of every cell involved in a rule conflict. */
export function conflictCells(state: GameState): ReadonlySet<number> {
  if (state.status === "idle") return new Set();
  const { size } = state.level;
  const out = new Set<number>();
  for (const conflict of findConflicts(state.board, state.level)) {
    for (const { r, c } of conflict.cells) out.add(r * size + c);
  }
  return out;
}
