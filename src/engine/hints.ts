import type { Board, Level } from "./types";
import { Cell } from "./types";

/**
 * The solution cell of the first row (top to bottom) with no face, or null when
 * every row has one. Pure; never reads the player's marks.
 */
export function nextHint(board: Board, level: Level): number | null {
  const { size, solution } = level;
  for (let r = 0; r < size; r++) {
    let hasFace = false;
    for (let c = 0; c < size && !hasFace; c++) {
      hasFace = board[r * size + c] === Cell.Face;
    }
    if (!hasFace) return r * size + solution[r];
  }
  return null;
}
