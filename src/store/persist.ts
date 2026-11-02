import type { GameState } from "./game";

export type SavedGame = Record<string, never>;

export function toSaved(state: GameState): SavedGame | null {
  if (state.status === "idle") return null;
  return {};
}
