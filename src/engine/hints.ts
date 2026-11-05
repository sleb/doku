import { explain } from "./hintText";
import { solveByTechniques } from "./solver";
import type { Deduction } from "./techniques";
import type { Board, Level } from "./types";
import { Cell } from "./types";

export interface Hint {
  deduction: Deduction; // technique, target cells, because
  message: string; // rendered from the technique's template
}

/**
 * The simplest deduction the player has not yet acted on: the first ladder
 * step from the board's faces that places a face, or eliminates at least one
 * cell the player has not already marked. Marks never change what is true, only
 * which steps are skipped. Null when the board is complete or the ladder is
 * stuck. Pure; never reads the solution.
 */
export function nextHint(board: Board, level: Level): Hint | null {
  const { steps } = solveByTechniques(level, board);
  const step = steps.find(
    (s) =>
      s.place !== undefined || s.eliminate.some((i) => board[i] !== Cell.Mark),
  );
  return step ? { deduction: step, message: explain(step) } : null;
}
