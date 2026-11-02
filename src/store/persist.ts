import type { GameState } from "./game";

export type SavedGame = {
  levelId: string;
  board: number[];
  wrong: number[];
  hearts: number;
  elapsedMs: number;
  hintsUsed: number;
};

export function toSaved(state: GameState): SavedGame | null {
  if (state.status === "idle") return null;
  if (state.status === "won" || state.status === "lost") return null;
  return {
    levelId: state.level.id,
    board: Array.from(state.board),
    wrong: [...state.wrong].sort((a, b) => a - b),
    hearts: state.hearts,
    elapsedMs: state.elapsedMs,
    hintsUsed: state.hintsUsed,
  };
}
